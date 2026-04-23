'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Building2, Crown, Hotel, Landmark, MessageCircle, Mountain, Store, Utensils } from 'lucide-react'

/** @type {readonly string[]} */
const CATEGORIAS_PROFISSIONAIS = ['motorista_app', 'van', 'taxista', 'guia', 'anfitriao']

/** @type {readonly string[]} */
const COMUNIDADES_PROFISSIONAIS = ['Guia', 'Taxista', 'Van', 'Motorista de App', 'Anfitriao']

/** Ordem amigável das categorias de empresa. */
const ORDEM_CATEGORIA_EMPRESA = ['Restaurantes', 'Atrativos', 'Lojas', 'Hospedagem']

const ROTULO_CATEGORIA = /** @type {const} */ ({
  Restaurantes: { Icon: Utensils, rótulo: 'Restaurantes' },
  Atrativos: { Icon: Mountain, rótulo: 'Atrativos' },
  Lojas: { Icon: Store, rótulo: 'Lojas' },
  Hospedagem: { Icon: Hotel, rótulo: 'Hospedagem' },
  Outros: { Icon: Building2, rótulo: 'Outros' },
})

/**
 * @param {string} cat
 * @returns {{ Icon: import('lucide-react').LucideIcon, rótulo: string }}
 */
function metaCategoriaEmpresa(cat) {
  if (Object.prototype.hasOwnProperty.call(ROTULO_CATEGORIA, cat)) {
    return /** @type {{ Icon: import('lucide-react').LucideIcon, rótulo: string }} */ (ROTULO_CATEGORIA[/** @type {keyof typeof ROTULO_CATEGORIA} */ (cat)])
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
  const [categoriaAba, setCategoriaAba] = useState(/** @type {string | null} */ (null))

  const part = useMemo(() => {
    const administracao = canais.filter(
      (c) => c.tipo_publico === 'profissional' && (c.categoria === 'admin' || nomeNorm(c.nome) === 'FINANCEIRO'),
    )
    const empresas = canais.filter((c) => c.tipo_publico === 'empresa' && c.empresa_id != null && c.comunidade_prof != null)
    return { administracao, empresas }
  }, [canais])

  const empresasPorCategoria = useMemo(() => {
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
    const entries = Object.entries(map)
    entries.sort((a, b) => {
      const ia = ORDEM_CATEGORIA_EMPRESA.indexOf(a[0])
      const ib = ORDEM_CATEGORIA_EMPRESA.indexOf(b[0])
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
      return a[0].localeCompare(b[0])
    })
    return entries
  }, [part.empresas])

  useEffect(() => {
    if (empresasPorCategoria.length === 0) {
      setCategoriaAba(null)
      return
    }
    const chaves = empresasPorCategoria.map(([k]) => k)
    setCategoriaAba((prev) => (prev && chaves.includes(prev) ? prev : chaves[0]))
  }, [empresasPorCategoria])

  const itensAbaAtiva = useMemo(() => {
    if (categoriaAba == null) return /** @type {Canal[]} */ ([])
    const f = empresasPorCategoria.find(([k]) => k === categoriaAba)
    return f ? f[1] : []
  }, [empresasPorCategoria, categoriaAba])

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
            <p className="px-4 pb-1 pt-3 text-xs font-bold tracking-wide text-[#0097b2]">ADMINISTRAÇÃO</p>
            {part.administracao.map((canal) => (
              <div key={canal.id} className="pl-0">
                {renderRow(canal)}
              </div>
            ))}
          </div>
        ) : null}

        {empresasPorCategoria.length > 0 && categoriaAba ? (
          <>
            <p className="shrink-0 bg-white px-4 pb-1 pt-2 text-xs font-bold tracking-wide text-gray-500">Segmentos (empresas)</p>
            <div
              className="sticky top-0 z-10 flex shrink-0 items-end gap-1 border-b border-gray-100 bg-white px-2 pb-0"
              role="tablist"
              aria-label="Categorias de empresas"
            >
              {empresasPorCategoria.map(([cat]) => {
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
                        ? 'mb-0 flex min-w-0 items-center gap-1.5 border-b-2 border-[#0097b2] px-2 py-2.5 text-sm font-medium text-[#0097b2]'
                        : 'mb-0.5 p-2 text-gray-400 opacity-80 hover:opacity-100'
                    }
                  >
                    {ativo ? <Icon className="h-5 w-5 shrink-0" aria-hidden /> : <Icon className="h-6 w-6 shrink-0" aria-hidden />}
                    {ativo ? <span className="truncate">{rótulo}</span> : null}
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
        ) : part.administracao.length > 0 ? (
          <p className="p-4 text-sm text-gray-500">Não há canais de empresas do seu segmento. Quando houver, aparecem abaixo.</p>
        ) : (
          <p className="p-4 text-sm text-gray-500">Nenhum canal disponível.</p>
        )}
      </div>
    </div>
  )
}
