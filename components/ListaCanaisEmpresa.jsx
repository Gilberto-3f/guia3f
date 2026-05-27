'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ChevronDown, ChevronUp, Crown, Landmark } from 'lucide-react'
import { rotuloNomeCanalAdministracao } from '@/lib/rotulosCanaisAdministracao'
import {
  CLASSE_AVATAR_CANAL_PROFISSIONAL,
  iconeCanalProfissionalLista,
  rotuloCanalProfissionalLista,
  toSlugComunidadeProf,
  tituloCanalEmpresaLista,
} from '@/lib/canaisProfissionaisListaUi'
import { buscarUltimasMensagensCanais, formatarListaHora } from '@/lib/canalLista'
import { contarFinanceiroNaoLidasEmpresa } from '@/lib/canaisEmpresaVisibilidade'
import { contarNaoLidasPorCanalIds } from '@/lib/canalBadge'
import { GUIA_CANAIS_BADGE_EVENT, notificarBadgeCanais } from '@/lib/canais-badge-events'
import { isCanalFinanceiroEmpresa } from '@/lib/canaisEmpresaSlugs'
import CanalListaRow from '@/components/CanalListaRow'
import CanalNaoLidasBadge from '@/components/CanalNaoLidasBadge'

/** @type {readonly string[]} */
const COMUNIDADES_PROFISSIONAIS_SLUG = ['guia', 'taxista', 'van', 'motorista_app', 'anfitriao']

/**
 * @param {string | null | undefined} valor
 */
function toSlug(valor) {
  return toSlugComunidadeProf(valor)
}

/**
 * @param {string} slug
 */
function slugToLabel(slug) {
  const s = String(slug ?? '').trim()
  if (s === 'motorista_app') return 'Motorista de App'
  if (s === 'guia') return 'Guia'
  if (s === 'taxista') return 'Taxista'
  if (s === 'van') return 'Van'
  if (s === 'anfitriao') return 'Anfitrião'
  return s
}

/**
 * @param {string | null | undefined} nome
 */
function nomeNorm(nome) {
  return (nome ?? '').trim().toUpperCase()
}

export { tituloCanalEmpresaLista }

/**
 * @typedef {{
 *   id: string
 *   nome: string
 *   tipo_publico: string | null
 *   categoria: string | null
  *   comunidade_prof?: string | null
  *   empresa_id?: string | null
 *   ordem_tipo: string | null
 *   ordem_posicao?: number | null
 *   ultima_mensagem_em: string | null
 * }} Canal
 */

/**
 * @param {string | null | undefined} n
 * @returns {number}
 */
function prioridadeAdmFinNome(n) {
  const u = (n ?? '').trim().toUpperCase()
  if (u === 'ADM') return 0
  if (u === 'FINANCEIRO') return 1
  return 2
}

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
 * Garante ADM antes de Financeiro na pasta administração.
 * @param {Array<{ nome?: string | null, ordem_tipo?: string | null, ordem_posicao?: number | null, ultima_mensagem_em?: string | null }>} lista
 */
function ordenarCanaisAdministracaoEmpresa(lista) {
  if (lista.length === 0) return /** @type {typeof lista} */ ([])
  const base = ordenarCanais([...lista])
  return base.sort((a, b) => {
    const pa = prioridadeAdmFinNome(a.nome)
    const pb = prioridadeAdmFinNome(b.nome)
    if (pa !== pb) return pa - pb
    if (a.ordem_tipo === 'fixo' && b.ordem_tipo === 'fixo') {
      return (a.ordem_posicao ?? 0) - (b.ordem_posicao ?? 0)
    }
    const ta = a.ultima_mensagem_em ? new Date(a.ultima_mensagem_em).getTime() : 0
    const tb = b.ultima_mensagem_em ? new Date(b.ultima_mensagem_em).getTime() : 0
    return tb - ta
  })
}

/**
 * @param {{
 *   onSelectCanal: (c: Canal) => void
 *   canalSelecionadoId?: string
 * }} props
 */
export default function ListaCanaisEmpresa({ onSelectCanal, canalSelecionadoId }) {
  const [canais, setCanais] = useState(/** @type {Canal[]} */ ([]))
  const [loading, setLoading] = useState(true)
  const [empresaId, setEmpresaId] = useState(/** @type {string | null} */ (null))
  /** @type {Record<string, { preview: string, created_at: string }>} */
  const [ultimasMensagens, setUltimasMensagens] = useState({})
  /** @type {Record<string, number>} */
  const [naoLidasPorCanal, setNaoLidasPorCanal] = useState({})

  /**
   * Garante que a pasta ADMINISTRAÇÃO sempre exiba ADM e Financeiro (nessa ordem).
   * Se o canal não existir no banco ainda, exibe um item desativado.
   * @param {Canal[]} lista
   */
  function garantirAdministracao(lista) {
    /** @type {Canal[]} */
    const out = []
    const adm = lista.find((c) => nomeNorm(c.nome) === 'ADM')
    const fin = lista.find((c) => nomeNorm(c.nome) === 'FINANCEIRO')
    out.push(
      adm ?? {
        id: '__placeholder_adm__',
        nome: 'ADM',
        tipo_publico: 'empresa',
        categoria: null,
        comunidade_prof: null,
        empresa_id: null,
        ordem_tipo: 'fixo',
        ordem_posicao: 1,
        ultima_mensagem_em: null,
      },
    )
    out.push(
      fin ?? {
        id: '__placeholder_financeiro__',
        nome: 'Financeiro',
        tipo_publico: 'empresa',
        categoria: null,
        comunidade_prof: null,
        empresa_id: null,
        ordem_tipo: 'fixo',
        ordem_posicao: 2,
        ultima_mensagem_em: null,
      },
    )
    return out
  }

  /**
   * Garante as 5 comunidades em PROFISSIONAIS (Empresa).
   * @param {Canal[]} lista
   */
  function garantirComunidadesProfissionais(lista) {
    /** @type {Map<string, Canal>} */
    const porComunidade = new Map()
    for (const c of lista) {
      const k = toSlug(c.comunidade_prof != null ? String(c.comunidade_prof) : '')
      if (!k) continue
      if (!porComunidade.has(k)) porComunidade.set(k, c)
    }

    return COMUNIDADES_PROFISSIONAIS_SLUG.map((slug) => {
      const real = porComunidade.get(slug)
      return (
        real ?? {
          id: `__placeholder_prof_${slug}__`,
          nome: slugToLabel(slug),
          tipo_publico: 'empresa',
          categoria: null,
          comunidade_prof: slugToLabel(slug),
          empresa_id: empresaId,
          ordem_tipo: 'rotativo',
          ordem_posicao: null,
          ultima_mensagem_em: null,
        }
      )
    })
  }

  const part = useMemo(() => {
    const administracao = ordenarCanaisAdministracaoEmpresa(
      canais.filter(
        (c) =>
          c.tipo_publico === 'empresa' &&
          c.empresa_id == null &&
          (nomeNorm(c.nome) === 'ADM' || nomeNorm(c.nome) === 'FINANCEIRO'),
      ),
    )
    const profissionais = canais
      .filter((c) => c.tipo_publico === 'empresa' && empresaId && String(c.empresa_id ?? '') === String(empresaId))
      .filter((c) => {
        const slug = toSlug(c.comunidade_prof != null ? String(c.comunidade_prof) : '')
        return Boolean(slug) && COMUNIDADES_PROFISSIONAIS_SLUG.includes(slug)
      })
    return {
      administracao: garantirAdministracao(administracao),
      profissionais: garantirComunidadesProfissionais(profissionais),
    }
  }, [canais, empresaId])

  const gruposIniciais = useMemo(
    () => ({
      administracao: part.administracao.length > 0,
      profissionais: part.profissionais.length > 0,
    }),
    [part],
  )

  const [gruposAbertos, setGruposAbertos] = useState(/** @type {Record<string, boolean>} */ ({}))

  useEffect(() => {
    setGruposAbertos((prev) => {
      const next = { ...gruposIniciais }
      for (const k of Object.keys(next)) {
        if (prev[k] != null) next[k] = prev[k]
      }
      return next
    })
  }, [gruposIniciais])

  const idsMonitor = useMemo(() => canais.map((c) => c.id), [canais])

  const recarregarContagens = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const uid = session?.user?.id
    if (!uid) return

    const ids = canais.map((c) => c.id).filter((id) => !String(id).startsWith('__placeholder'))
    if (ids.length === 0) {
      setNaoLidasPorCanal({})
      return
    }

    const contagens = await contarNaoLidasPorCanalIds(supabase, uid, ids)
    const fin = await contarFinanceiroNaoLidasEmpresa(supabase, uid)
    for (const c of canais) {
      if (isCanalFinanceiroEmpresa(c.nome)) {
        contagens[c.id] = fin
      }
    }
    setNaoLidasPorCanal(contagens)
  }, [canais])

  useEffect(() => {
    const onBadge = () => {
      void recarregarContagens()
    }
    window.addEventListener(GUIA_CANAIS_BADGE_EVENT, onBadge)
    return () => window.removeEventListener(GUIA_CANAIS_BADGE_EVENT, onBadge)
  }, [recarregarContagens])

  useEffect(() => {
    if (canais.length === 0) return
    void recarregarContagens()
  }, [canais, recarregarContagens])

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
      const { data: emp } = await supabase.from('empresas').select('id').eq('usuario_id', uid).maybeSingle()
      const empId = emp?.id != null ? String(emp.id) : null
      setEmpresaId(empId)

      const { data, error } = await supabase
        .from('canais')
        .select('id, nome, tipo_publico, categoria, comunidade_prof, empresa_id, ultima_mensagem_em, ordem_tipo, ordem_posicao')
        .eq('tipo_publico', 'empresa')
        .eq('ativo', true)

      if (error) throw error
      const lista = /** @type {Canal[]} */ (data ?? [])
      const filtrada = lista.filter((c) => {
        if (c.empresa_id == null) {
          return nomeNorm(c.nome) === 'ADM' || nomeNorm(c.nome) === 'FINANCEIRO'
        }
        return empId != null && String(c.empresa_id ?? '') === String(empId)
      })
      const ordenados = ordenarCanais(filtrada)
      setCanais(ordenados)
      const ids = ordenados.map((c) => c.id).filter((id) => !String(id).startsWith('__placeholder'))
      const ultimas = await buscarUltimasMensagensCanais(supabase, ids)
      setUltimasMensagens(ultimas)

      const contagens = await contarNaoLidasPorCanalIds(supabase, uid, ids)
      const fin = await contarFinanceiroNaoLidasEmpresa(supabase, uid)
      for (const c of ordenados) {
        if (isCanalFinanceiroEmpresa(c.nome)) {
          contagens[c.id] = fin
        }
      }
      setNaoLidasPorCanal(contagens)
    } catch (e) {
      console.error('Erro ao carregar canais empresa:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    if (idsMonitor.length === 0) return

    const ch = supabase.channel('lista-canais-empresa-mensagens')
    for (const canalId of idsMonitor) {
      ch.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensagens_canal', filter: `canal_id=eq.${canalId}` },
        () => {
          notificarBadgeCanais()
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
    if (nomeNorm(canal.nome) === 'ADM') return Crown
    return Landmark
  }

  /**
   * @param {Canal} canal
   * @param {{ pastaProfissionais?: boolean }} [opts]
   */
  function renderRow(canal, opts = {}) {
    const ehProfissional =
      opts.pastaProfissionais ||
      (canal.comunidade_prof != null && String(canal.comunidade_prof).trim() !== '')
    const Icon = ehProfissional ? iconeCanalProfissionalLista(canal) : getIcon(canal)
    const isActive = canalSelecionadoId === canal.id
    const isPlaceholder = String(canal.id ?? '').startsWith('__placeholder_')
    const label =
      canal.empresa_id == null && (nomeNorm(canal.nome) === 'ADM' || nomeNorm(canal.nome) === 'FINANCEIRO')
        ? rotuloNomeCanalAdministracao(canal.nome)
        : ehProfissional
          ? rotuloCanalProfissionalLista(canal)
          : canal.nome
    const ultima = ultimasMensagens[canal.id]
    const horaIso = canal.ultima_mensagem_em ?? ultima?.created_at ?? null
    const naoLidas = naoLidasPorCanal[canal.id] ?? 0

    return (
      <CanalListaRow
        key={canal.id}
        label={label}
        preview={ehProfissional ? null : ultima?.preview || (horaIso ? ' ' : null)}
        hora={ehProfissional ? null : formatarListaHora(horaIso)}
        somenteTitulo={ehProfissional}
        naoLidas={naoLidas}
        active={isActive}
        disabled={isPlaceholder}
        onClick={() => {
          if (isPlaceholder) return
          onSelectCanal(canal)
        }}
        avatar={
          <div
            className={
              ehProfissional
                ? CLASSE_AVATAR_CANAL_PROFISSIONAL
                : `flex h-12 w-12 shrink-0 items-center justify-center rounded-md ${
                    isActive ? 'bg-[#0097b2] text-white' : 'bg-gray-100 text-gray-500'
                  }`
            }
          >
            <Icon size={22} aria-hidden />
          </div>
        }
      />
    )
  }

  const toggleGrupo = (id) => {
    setGruposAbertos((prev) => {
      const aberto = prev[id] !== false
      return { ...prev, [id]: !aberto }
    })
  }

  /**
   * @param {{ id: string; titulo: string; itens: Canal[]; forcarVazio?: boolean; mensagemVazio?: string }} args
   */
  function renderGrupo({ id, titulo, itens, forcarVazio, mensagemVazio }) {
    if (itens.length === 0 && !forcarVazio) return null
    const aberto = gruposAbertos[id] !== false
    const totalPasta = itens.reduce((s, c) => s + (naoLidasPorCanal[c.id] ?? 0), 0)
    return (
      <div className="border-b border-gray-100">
        <button
          type="button"
          onClick={() => toggleGrupo(id)}
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-base"
        >
          <span className="font-bold leading-snug text-[#0097b2]">{titulo}</span>
          <span className="flex shrink-0 items-center gap-2">
            {!aberto ? <CanalNaoLidasBadge count={totalPasta} /> : null}
            {aberto ? (
              <ChevronUp size={18} aria-hidden className="text-[#0097b2]" />
            ) : (
              <ChevronDown size={18} aria-hidden className="text-[#0097b2]" />
            )}
          </span>
        </button>
        {aberto ? (
          itens.length === 0 && mensagemVazio ? (
            <p className="px-4 pb-4 pl-8 text-sm text-gray-500">{mensagemVazio}</p>
          ) : (
            <div>
              {itens.map((canal) => (
                <div key={canal.id} className="pl-4">
                  {renderRow(canal, { pastaProfissionais: id === 'profissionais' })}
                </div>
              ))}
            </div>
          )
        ) : null}
      </div>
    )
  }

  if (loading) {
    return <div className="p-4 text-center text-gray-400">Carregando canais...</div>
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="min-h-0 flex-1 overflow-y-auto bg-white">
        {renderGrupo({ id: 'administracao', titulo: 'ADMINISTRAÇÃO', itens: part.administracao })}
        {renderGrupo({
          id: 'profissionais',
          titulo: 'PROFISSIONAIS',
          itens: ordenarCanais(part.profissionais),
        })}
      </div>
    </div>
  )
}
