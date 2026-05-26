'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Building2, ChevronDown, ChevronUp, Landmark, MessageCircle, ShoppingBag, Star, Ticket, Utensils } from 'lucide-react'
import { rotuloNomeCanalAdministracao } from '@/lib/rotulosCanaisAdministracao'
import {
  isCanalAdmProfissionalGlobal,
  isCanalFinanceiroProfissional,
  slugCanalComunidadeProfissional,
} from '@/lib/canaisProfissionalSlugs'
import CanalEmpresaRow from '@/components/CanalEmpresaRow'
import CanalListaRow from '@/components/CanalListaRow'
import { buscarUltimasMensagensCanais, canalTemNaoLidas, formatarListaHora } from '@/lib/canalLista'

/** @type {readonly string[]} */
const CATEGORIAS_PROFISSIONAIS = ['motorista_app', 'van', 'taxista', 'guia', 'anfitriao']

/** @type {readonly string[]} */
const COMUNIDADES_PROFISSIONAIS = ['Guia', 'Taxista', 'Van', 'Motorista de App', 'Anfitriao']

/** Ordem amigável das categorias de empresa. */
const ORDEM_CATEGORIA_EMPRESA = ['Restaurantes', 'Atrativos', 'Lojas', 'Hospedagem']

/**
 * Normalização de comunidade/categoria para slug.
 * Salvaguarda: o banco pode ter `canais.comunidade_prof` e `profissionais.categorias` em rótulo OU slug.
 * Antes de “fixar” tudo em slug via SQL, rode `SELECT DISTINCT comunidade_prof ...` e alinhe RLS + dados.
 * Ver também: docs/PROMPT-canais-habilitar-salvaguardas.txt
 */
/** @type {Record<string, string>} */
const CATEGORIA_TO_SLUG = {
  'Motorista de App': 'motorista_app',
  'Motorista de Aplicativo': 'motorista_app',
  'Guia de Turismo': 'guia',
  Guia: 'guia',
  Taxista: 'taxista',
  Van: 'van',
  Anfitrião: 'anfitriao',
  Anfitriao: 'anfitriao',
}

/**
 * Normaliza rótulos/categorias para slug do banco (sem acento, minúsculo, com "_").
 * @param {string} valor
 */
function toSlug(valor) {
  const raw = String(valor ?? '').trim()
  if (!raw) return ''
  const mapped = CATEGORIA_TO_SLUG[raw]
  const base = mapped ?? raw.toLowerCase()
  return base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .trim()
}

/**
 * Slugs legados em `empresa_categoria` → chave da aba (rótulo fixo das 4 principais).
 * @type {Record<string, string>}
 */
const EMPRESA_CATEGORIA_SLUG_PARA_ABA = {
  gastronomia: 'Restaurantes',
  passeios: 'Atrativos',
  atrativos: 'Atrativos',
  lojas: 'Lojas',
  hospedagem: 'Hospedagem',
}

/**
 * Rótulos já “humanos” (se vierem assim no banco) → mesma chave de aba.
 * @type {Record<string, string>}
 */
const EMPRESA_CATEGORIA_ROTULO_PARA_ABA = {
  Restaurantes: 'Restaurantes',
  Atrativos: 'Atrativos',
  Lojas: 'Lojas',
  Hospedagem: 'Hospedagem',
}

/**
 * @param {string | null | undefined} empresaCategoria
 */
function chaveAbaEmpresaCategoria(empresaCategoria) {
  const raw = String(empresaCategoria ?? '').trim()
  if (!raw) return 'Outros'
  const slug = toSlug(raw)
  if (slug && EMPRESA_CATEGORIA_SLUG_PARA_ABA[slug]) return EMPRESA_CATEGORIA_SLUG_PARA_ABA[slug]
  if (EMPRESA_CATEGORIA_ROTULO_PARA_ABA[raw]) return EMPRESA_CATEGORIA_ROTULO_PARA_ABA[raw]
  const rawLower = raw.toLowerCase()
  if (EMPRESA_CATEGORIA_ROTULO_PARA_ABA[rawLower]) return EMPRESA_CATEGORIA_ROTULO_PARA_ABA[rawLower]
  return raw
}

/** Estrela preenchida (aba Hospedagem). */
function IconHospedagemEstrela({ className, 'aria-hidden': ariaHidden = true }) {
  return (
    <Star
      className={className}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1}
      aria-hidden={ariaHidden}
    />
  )
}
IconHospedagemEstrela.displayName = 'IconHospedagemEstrela'

const ROTULO_CATEGORIA = /** @type {const} */ ({
  Restaurantes: { Icon: Utensils, rótulo: 'Restaurantes' },
  Atrativos: { Icon: Ticket, rótulo: 'Atrativos' },
  Lojas: { Icon: ShoppingBag, rótulo: 'Lojas' },
  Hospedagem: { Icon: IconHospedagemEstrela, rótulo: 'Hospedagem' },
  Outros: { Icon: Building2, rótulo: 'Outros' },
})

/**
 * @param {string} cat
 */
function metaCategoriaEmpresa(cat) {
  if (Object.prototype.hasOwnProperty.call(ROTULO_CATEGORIA, cat)) {
    return /** @type {{ Icon: import('lucide-react').LucideIcon | typeof IconHospedagemEstrela, rótulo: string }} */ (
      ROTULO_CATEGORIA[/** @type {keyof typeof ROTULO_CATEGORIA} */ (cat)]
    )
  }
  return { Icon: Building2, rótulo: cat }
}

/**
 * @param {string | null | undefined} nome
 */
function nomeNorm(nome) {
  return (nome ?? '').trim().toUpperCase()
}

/**
 * @typedef {{
 *   id: string
 *   nome: string
 *   tipo_publico: string | null
 *   categoria: string | null
 *   comunidade_prof?: string | null
 *   empresa_id?: string | null
 *   empresa_categoria?: string | null
 *   ordem_tipo: string | null
 *   ordem_posicao?: number | null
 *   ultima_mensagem_em: string | null
 * }} Canal
 */

/**
 * @param {Canal[]} lista
 */
function ordenarCanais(lista) {
  const fixos = lista.filter((c) => c.ordem_tipo === 'fixo').sort((a, b) => (a.ordem_posicao ?? 0) - (b.ordem_posicao ?? 0))
  const rotativos = lista.filter((c) => c.ordem_tipo !== 'fixo')
  rotativos.sort((a, b) => {
    const ta = a.ultima_mensagem_em ? new Date(a.ultima_mensagem_em).getTime() : 0
    const tb = b.ultima_mensagem_em ? new Date(b.ultima_mensagem_em).getTime() : 0
    return tb - ta
  })
  return [...fixos, ...rotativos]
}

/**
 * @param {{
 *   onSelectCanal: (c: Canal) => void
 *   canalSelecionadoId?: string
 *   leituraTick?: number
 * }} props
 */
export default function ListaCanaisProfissional({ onSelectCanal, canalSelecionadoId, leituraTick = 0 }) {
  const [canais, setCanais] = useState(/** @type {Canal[]} */ ([]))
  const [loading, setLoading] = useState(true)
  /** @type {Record<string, { preview: string, created_at: string }>} */
  const [ultimasMensagens, setUltimasMensagens] = useState({})
  /** @type {Record<string, string>} */
  const [leiturasPorCanal, setLeiturasPorCanal] = useState({})
  const [categoriaAba, setCategoriaAba] = useState(ORDEM_CATEGORIA_EMPRESA[0] ?? 'Restaurantes')
  const [gruposAbertos, setGruposAbertos] = useState(/** @type {Record<string, boolean>} */ ({ administracao: false }))

  const part = useMemo(() => {
    const administracao = canais.filter(
      (c) => c.tipo_publico === 'profissional' && !isCanalAdmProfissionalGlobal(c),
    )
    const empresas = canais.filter((c) => c.tipo_publico === 'empresa' && c.empresa_id != null && c.comunidade_prof != null)
    return { administracao, empresas }
  }, [canais])

  /** Sempre expõe as 4 segmentações de empresas (vazias se necessário) + outras chaves com canais. */
  const abasCategoriasEmpresas = useMemo(() => {
    /** @type {Record<string, Canal[]>} */
    const map = {}
    for (const c of part.empresas) {
      const cat = chaveAbaEmpresaCategoria(c.empresa_categoria)
      if (!map[cat]) map[cat] = []
      map[cat].push(c)
    }
    for (const k of Object.keys(map)) {
      map[k] = ordenarCanais(map[k])
    }
    const fixas = ORDEM_CATEGORIA_EMPRESA.map((cat) => /** @type {[string, Canal[]]} */ ([cat, map[cat] ? [...map[cat]] : []]))
    const visto = new Set(ORDEM_CATEGORIA_EMPRESA)
    const extras = Object.keys(map)
      .filter((k) => !visto.has(k))
      .sort((a, b) => a.localeCompare(b))
    const extraPairs = extras.map((k) => /** @type {[string, Canal[]]} */ ([k, map[k] ?? []]))
    return [...fixas, ...extraPairs]
  }, [part.empresas])

  useEffect(() => {
    const chaves = abasCategoriasEmpresas.map(([k]) => k)
    if (chaves.length === 0) {
      return
    }
    setCategoriaAba((prev) => (prev && chaves.includes(prev) ? prev : chaves[0]))
  }, [abasCategoriasEmpresas])

  const itensAbaAtiva = useMemo(() => {
    if (categoriaAba == null) return /** @type {Canal[]} */ ([])
    const f = abasCategoriasEmpresas.find(([k]) => k === categoriaAba)
    return f ? f[1] : []
  }, [abasCategoriasEmpresas, categoriaAba])

  const toggleGrupo = (id) => {
    setGruposAbertos((prev) => {
      const aberto = prev[id] !== false
      return { ...prev, [id]: !aberto }
    })
  }

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const uid = session?.user?.id
      if (!uid) {
        setCanais([])
        return
      }

      const { data: prof } = await supabase.from('profissionais').select('categorias').eq('usuario_id', uid).maybeSingle()
      const cats = Array.isArray(prof?.categorias) ? prof.categorias.map(String) : []
      const slugsProfissional = cats.map((c) => toSlug(c)).filter(Boolean)

      /** @type {Set<string> | null} */
      let empresasAprovadas = null
      try {
        const { data: emps, error: empErr } = await supabase.from('empresas').select('id').eq('status', 'aprovado')
        if (empErr) throw empErr
        empresasAprovadas = new Set((emps ?? []).map((e) => String(e.id)))
      } catch {
        // Se falhar (colunas/RLS), não bloqueia exibição: ainda filtramos por comunidade_prof.
        empresasAprovadas = null
      }

      const { data, error } = await supabase
        .from('canais')
        .select(
          `
          id, nome, tipo_publico, categoria, comunidade_prof, empresa_id, empresa_categoria, ultima_mensagem_em, ordem_tipo, ordem_posicao,
          empresas:empresa_id ( id, nome_fantasia, foto_url, cidade, status )
          `,
        )
        .eq('ativo', true)
        .in('tipo_publico', ['profissional', 'empresa'])

      if (error) throw error
      const lista = /** @type {Canal[]} */ (data ?? [])
      const filtrada = lista.filter((c) => {
        if (c.tipo_publico === 'profissional') {
          if (isCanalAdmProfissionalGlobal(c)) return false
          if (isCanalFinanceiroProfissional(c.nome)) return true
          const slug = slugCanalComunidadeProfissional(c.categoria, c.nome)
          return slug != null && slugsProfissional.includes(slug)
        }
        if (c.tipo_publico === 'empresa') {
          if (c.empresa_id == null) return false
          if (empresasAprovadas && !empresasAprovadas.has(String(c.empresa_id))) return false
          const comuSlug = toSlug(c.comunidade_prof != null ? String(c.comunidade_prof) : '')
          if (!comuSlug || !CATEGORIAS_PROFISSIONAIS.includes(comuSlug)) return false
          return slugsProfissional.includes(comuSlug)
        }
        return false
      })
      const ordenados = ordenarCanais(filtrada)
      setCanais(ordenados)

      const ids = ordenados.map((c) => c.id).filter((id) => !String(id).startsWith('__placeholder'))
      const [ultimas, leiturasRes] = await Promise.all([
        buscarUltimasMensagensCanais(supabase, ids),
        supabase.from('canal_leitura_profissional').select('canal_id, visto_em').eq('usuario_id', uid),
      ])
      setUltimasMensagens(ultimas)

      /** @type {Record<string, string>} */
      const leituras = {}
      for (const row of leiturasRes.data ?? []) {
        leituras[String(row.canal_id)] = String(row.visto_em ?? '')
      }
      setLeiturasPorCanal(leituras)
    } catch (e) {
      console.error('Erro ao carregar canais profissional:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar, leituraTick])

  const idsMonitor = useMemo(() => canais.map((c) => c.id), [canais])

  useEffect(() => {
    if (idsMonitor.length === 0) return

    const ch = supabase.channel('lista-canais-prof-mensagens')
    for (const canalId of idsMonitor) {
      ch.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensagens_canal', filter: `canal_id=eq.${canalId}` },
        () => {
          void carregar()
        },
      )
    }
    void ch.subscribe()

    return () => {
      void supabase.removeChannel(ch)
    }
  }, [idsMonitor, carregar])

  /**
   * @param {Canal} canal
   */
  const getIcon = (canal) => {
    if (canal.tipo_publico === 'empresa') return Building2
    if (isCanalFinanceiroProfissional(canal.nome)) return Landmark
    return MessageCircle
  }

  /**
   * @param {Canal} canal
   * @param {{ blocoAdministracao?: boolean }} [opts]
   */
  function renderRow(canal, opts = {}) {
    const Icon = getIcon(canal)
    const isActive = canalSelecionadoId === canal.id
    const label =
      opts.blocoAdministracao && isCanalFinanceiroProfissional(canal.nome)
        ? rotuloNomeCanalAdministracao(canal.nome)
        : canal.nome
    const ultima = ultimasMensagens[canal.id]
    const horaIso = canal.ultima_mensagem_em ?? ultima?.created_at ?? null
    const naoLidas = canalTemNaoLidas(canal.ultima_mensagem_em, leiturasPorCanal[canal.id]) ? 1 : 0

    if (!opts.blocoAdministracao && canal.tipo_publico === 'empresa') {
      const comuSlug = toSlug(canal.comunidade_prof != null ? String(canal.comunidade_prof) : '')
      const comunidadeLabel =
        comuSlug === 'motorista_app'
          ? 'Motorista de App'
          : comuSlug === 'guia'
            ? 'Guia'
            : comuSlug === 'taxista'
              ? 'Taxista'
              : comuSlug === 'van'
                ? 'Van'
                : comuSlug === 'anfitriao'
                  ? 'Anfitrião'
                  : canal.comunidade_prof

      return (
        <CanalEmpresaRow
          key={canal.id}
          canal={canal}
          comunidadeLabel={comunidadeLabel}
          onClick={() => onSelectCanal(canal)}
          active={isActive}
          preview={ultima?.preview ?? comunidadeLabel}
          hora={formatarListaHora(horaIso)}
          naoLidas={naoLidas}
        />
      )
    }
    return (
      <CanalListaRow
        key={canal.id}
        label={label}
        preview={ultima?.preview || (horaIso ? ' ' : null)}
        hora={formatarListaHora(horaIso)}
        naoLidas={naoLidas}
        active={isActive}
        onClick={() => onSelectCanal(canal)}
        avatar={
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
              isActive ? 'bg-[#0097b2] text-white' : 'bg-gray-100 text-gray-500'
            }`}
          >
            <Icon size={22} aria-hidden />
          </div>
        }
      />
    )
  }

  if (loading) {
    return <div className="p-4 text-center text-gray-400">Carregando canais...</div>
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="min-h-0 flex min-h-0 flex-1 flex-col overflow-y-auto md:min-h-0">
        {part.administracao.length > 0 ? (
          <div className="shrink-0 border-b border-gray-100">
            <button
              type="button"
              onClick={() => toggleGrupo('administracao')}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-base"
            >
              <span className="font-bold leading-snug text-[#0097b2]">ADMINISTRAÇÃO</span>
              {gruposAbertos['administracao'] !== false ? (
                <ChevronUp size={18} aria-hidden className="shrink-0 text-[#0097b2]" />
              ) : (
                <ChevronDown size={18} aria-hidden className="shrink-0 text-[#0097b2]" />
              )}
            </button>
            {gruposAbertos['administracao'] !== false ? (
              <div>
                {part.administracao.map((canal) => (
                  <div key={canal.id} className="pl-0">
                    {renderRow(canal, { blocoAdministracao: true })}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {categoriaAba && abasCategoriasEmpresas.length > 0 ? (
          <>
            <div
              className="sticky top-0 z-10 w-full min-w-0 shrink-0 bg-[#0097b2]"
              role="tablist"
              aria-label="Categorias"
            >
              <div className="flex gap-1 p-1">
                {abasCategoriasEmpresas.map(([cat]) => {
                  const ativo = categoriaAba === cat
                  const { Icon, rótulo } = metaCategoriaEmpresa(cat)
                  return (
                    <button
                      key={cat}
                      type="button"
                      role="tab"
                      aria-selected={ativo}
                      aria-label={rótulo}
                      onClick={() => setCategoriaAba(cat)}
                      className={`flex min-h-[3rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2 text-center transition-all min-[400px]:min-h-[3.25rem] sm:flex-row sm:gap-1.5 sm:px-2 sm:py-2.5 ${
                        ativo
                          ? 'bg-white font-semibold text-[#0097b2] shadow-sm'
                          : 'text-white hover:bg-white/15'
                      }`}
                    >
                      <Icon className="h-5 w-5 shrink-0" aria-hidden />
                      {ativo ? (
                        <span className="max-w-full text-[0.65rem] font-medium leading-tight [overflow-wrap:balance] min-[400px]:text-xs">
                          {rótulo}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="min-h-0 flex-1" role="tabpanel">
              {itensAbaAtiva.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">Nenhum canal nesta categoria.</p>
              ) : (
                itensAbaAtiva.map((canal) => (
                  <div key={canal.id} className="pl-0">
                    {renderRow(canal)}
                  </div>
                ))
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
