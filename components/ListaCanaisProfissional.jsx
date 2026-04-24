'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Building2, ChevronDown, ChevronUp, Crown, Landmark, MessageCircle, ShoppingBag, Ticket, Utensils } from 'lucide-react'

/** @type {readonly string[]} */
const CATEGORIAS_PROFISSIONAIS = ['motorista_app', 'van', 'taxista', 'guia', 'anfitriao']

/** @type {readonly string[]} */
const COMUNIDADES_PROFISSIONAIS = ['Guia', 'Taxista', 'Van', 'Motorista de App', 'Anfitriao']

/** Ordem amigável das categorias de empresa. */
const ORDEM_CATEGORIA_EMPRESA = ['Restaurantes', 'Atrativos', 'Lojas', 'Hospedagem']

/**
 * Símbolo “sono” (Zzz) para hospedagem — fora de Lucide.
 * @param {{ className?: string, 'aria-hidden'?: boolean }} p
 */
function IconSonoZz({ className, ...rest }) {
  return (
    <span
      className={`inline-flex select-none items-center justify-center text-current ${className ?? 'h-6 w-6'}`}
      aria-hidden={rest['aria-hidden'] ?? true}
    >
      <span className="pr-px text-[0.7rem] font-extrabold italic leading-none tracking-[-0.2em] sm:text-[0.8rem]">Zzz</span>
    </span>
  )
}
IconSonoZz.displayName = 'IconSonoZz'

const ROTULO_CATEGORIA = /** @type {const} */ ({
  Restaurantes: { Icon: Utensils, rótulo: 'Restaurantes' },
  Atrativos: { Icon: Ticket, rótulo: 'Atrativos' },
  Lojas: { Icon: ShoppingBag, rótulo: 'Lojas' },
  Hospedagem: { Icon: IconSonoZz, rótulo: 'Hospedagem' },
  Outros: { Icon: Building2, rótulo: 'Outros' },
})

/**
 * @param {string} cat
 */
function metaCategoriaEmpresa(cat) {
  if (Object.prototype.hasOwnProperty.call(ROTULO_CATEGORIA, cat)) {
    return /** @type {{ Icon: import('lucide-react').LucideIcon, rótulo: string } | { Icon: typeof IconSonoZz, rótulo: string }} */ (
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
  const [categoriaAba, setCategoriaAba] = useState(ORDEM_CATEGORIA_EMPRESA[0] ?? 'Restaurantes')
  const [gruposAbertos, setGruposAbertos] = useState(/** @type {Record<string, boolean>} */ ({ administracao: true }))

  const part = useMemo(() => {
    const administracao = canais.filter(
      (c) => c.tipo_publico === 'profissional' && (c.categoria === 'admin' || nomeNorm(c.nome) === 'FINANCEIRO'),
    )
    const empresas = canais.filter((c) => c.tipo_publico === 'empresa' && c.empresa_id != null && c.comunidade_prof != null)
    return { administracao, empresas }
  }, [canais])

  /** Sempre expõe as 4 segmentações de empresas (vazias se necessário) + outras chaves com canais. */
  const abasCategoriasEmpresas = useMemo(() => {
    /** @type {Record<string, Canal[]>} */
    const map = {}
    for (const c of part.empresas) {
      const cat = String(c.empresa_categoria ?? '').trim() || 'Outros'
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

      const { data, error } = await supabase
        .from('canais')
        .select(
          'id, nome, tipo_publico, categoria, comunidade_prof, empresa_id, empresa_categoria, ultima_mensagem_em, ordem_tipo, ordem_posicao',
        )
        .eq('ativo', true)
        .in('tipo_publico', ['profissional', 'empresa'])

      if (error) throw error
      const lista = /** @type {Canal[]} */ (data ?? [])
      const filtrada = lista.filter((c) => {
        if (c.tipo_publico === 'profissional') {
          if (c.categoria === 'admin' || nomeNorm(c.nome) === 'FINANCEIRO') return true
          return c.categoria != null && CATEGORIAS_PROFISSIONAIS.includes(c.categoria)
        }
        if (c.tipo_publico === 'empresa') {
          if (c.empresa_id == null) return false
          const comu = c.comunidade_prof != null ? String(c.comunidade_prof) : ''
          if (!comu || !COMUNIDADES_PROFISSIONAIS.includes(comu)) return false
          return cats.includes(comu)
        }
        return false
      })
      setCanais(ordenarCanais(filtrada))
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
    if (nomeNorm(canal.nome) === 'ADM') return Crown
    if (nomeNorm(canal.nome) === 'FINANCEIRO') return Landmark
    return MessageCircle
  }

  /**
   * @param {Canal} canal
   */
  function renderRow(canal) {
    const Icon = getIcon(canal)
    const isActive = canalSelecionadoId === canal.id
    return (
      <button
        key={canal.id}
        type="button"
        onClick={() => onSelectCanal(canal)}
        className={`flex w-full items-center gap-3 border-b border-gray-100 p-4 text-left transition-colors ${
          isActive ? 'bg-[#0097b2]/5' : 'hover:bg-gray-50'
        }`}
      >
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            isActive ? 'bg-[#0097b2] text-white' : 'bg-gray-100 text-gray-500'
          }`}
        >
          <Icon size={20} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-gray-800">{canal.nome}</h3>
        </div>
      </button>
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
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <span className="text-xs font-bold tracking-wide text-[#0097b2]">ADMINISTRAÇÃO</span>
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
                    {renderRow(canal)}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {categoriaAba && abasCategoriasEmpresas.length > 0 ? (
          <>
            <p className="shrink-0 bg-white px-4 pb-1 pt-2 text-xs font-bold tracking-wide text-gray-500">Segmentos (empresas)</p>
            <div
              className="sticky top-0 z-10 flex w-full min-w-0 shrink-0 items-stretch border-b border-gray-100 bg-white pl-0 pr-0"
              role="tablist"
              aria-label="Categorias de empresas"
            >
              {abasCategoriasEmpresas.map(([cat]) => {
                const ativo = categoriaAba === cat
                const { Icon, rótulo } = metaCategoriaEmpresa(cat)
                return (
                  <button
                    key={cat}
                    type="button"
                    role="tab"
                    aria-selected={ativo}
                    onClick={() => setCategoriaAba(cat)}
                    className={
                      ativo
                        ? 'min-w-0 flex-1 border-b-2 border-b-[#0097b2] text-[#0097b2]'
                        : 'min-w-0 flex-1 border-b-2 border-b-transparent text-gray-400 opacity-80 hover:opacity-100'
                    }
                  >
                    {ativo ? (
                      <div className="mx-auto flex min-h-[2.65rem] w-full max-w-[5.5rem] flex-col items-center justify-center gap-0.5 py-1.5 sm:max-w-[5.8rem] sm:min-w-[5.2rem] sm:flex-row sm:items-center sm:gap-1 sm:py-2.5 sm:pl-0 sm:pr-0">
                        <Icon className="h-5 w-5 shrink-0" aria-hidden />
                        <span className="text-center text-[0.7rem] font-medium leading-tight [word-break:keep-all] [overflow-wrap:balance] min-[400px]:text-xs">
                          {rótulo}
                        </span>
                      </div>
                    ) : (
                      <div className="flex min-h-[2.75rem] items-center justify-center py-1.5">
                        <Icon className="h-6 w-6 shrink-0 sm:h-7 sm:w-7" aria-hidden />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
            <div className="min-h-0 flex-1" role="tabpanel">
              {itensAbaAtiva.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">Nenhum canal neste segmento.</p>
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
