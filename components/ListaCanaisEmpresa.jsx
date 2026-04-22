'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Building2, ChevronDown, ChevronUp, Crown } from 'lucide-react'

/** @type {readonly string[]} */
const CATEGORIAS_EMPRESAS = ['gastronomia', 'lojas', 'passeios', 'hospedagem']

const NOMES_EMPRESA_SEGMENTO = ['Gastronomia', 'Lojas', 'Passeios', 'Hospedagem']

/**
 * @param {string | null | undefined} nome
 */
function nomeNorm(nome) {
  return (nome ?? '').trim().toUpperCase()
}

/**
 * Título no cabeçalho / lista (nome na BD → rótulo).
 * @param {string} nomeDb
 */
export function tituloCanalEmpresaLista(nomeDb) {
  const map = {
    Vans: 'Motoristas Van',
    'Táxis': 'Taxistas',
    Guias: 'Guias de Turismo',
  }
  return map[nomeDb] ?? nomeDb
}

/**
 * @typedef {{
 *   id: string
 *   nome: string
 *   tipo_publico: string | null
 *   categoria: string | null
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
    if (tb !== ta) return tb - ta
    return NOMES_EMPRESA_SEGMENTO.indexOf(a.nome) - NOMES_EMPRESA_SEGMENTO.indexOf(b.nome)
  })
  return [...fixos, ...rotativos]
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

  const part = useMemo(() => {
    const administracao = canais.filter((c) => c.tipo_publico === 'empresa' && nomeNorm(c.nome) === 'ADM')
    const catEmp = (c) => {
      const cat = (c.categoria ?? '').toLowerCase()
      if (CATEGORIAS_EMPRESAS.includes(cat)) return true
      const n = (c.nome ?? '').trim().toLowerCase()
      return CATEGORIAS_EMPRESAS.includes(n)
    }
    const empresas = canais.filter((c) => c.tipo_publico === 'empresa' && nomeNorm(c.nome) !== 'ADM' && catEmp(c))
    return { administracao, empresas }
  }, [canais])

  const gruposIniciais = useMemo(
    () => ({
      administracao: part.administracao.length > 0,
      empresas: part.empresas.length > 0,
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

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('canais')
        .select('id, nome, tipo_publico, categoria, ultima_mensagem_em, ordem_tipo, ordem_posicao')
        .eq('tipo_publico', 'empresa')
        .eq('ativo', true)

      if (error) throw error
      const lista = /** @type {Canal[]} */ (data ?? [])
      const catEmp = (c) => {
        const cat = (c.categoria ?? '').toLowerCase()
        if (CATEGORIAS_EMPRESAS.includes(cat)) return true
        const n = (c.nome ?? '').trim().toLowerCase()
        return CATEGORIAS_EMPRESAS.includes(n)
      }
      const filtrada = lista.filter((c) => nomeNorm(c.nome) === 'ADM' || catEmp(c))
      setCanais(ordenarCanais(filtrada))
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
    return Building2
  }

  /**
   * @param {Canal} canal
   */
  function renderRow(canal) {
    const Icon = getIcon(canal)
    const isActive = canalSelecionadoId === canal.id
    const label = tituloCanalEmpresaLista(canal.nome)
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
          <h3 className="font-medium text-gray-800">{label}</h3>
        </div>
      </button>
    )
  }

  const toggleGrupo = (id) => {
    setGruposAbertos((prev) => {
      const aberto = prev[id] !== false
      return { ...prev, [id]: !aberto }
    })
  }

  /**
   * @param {{ id: string; titulo: string; itens: Canal[] }} args
   */
  function renderGrupo({ id, titulo, itens }) {
    if (itens.length === 0) return null
    const aberto = gruposAbertos[id] !== false
    return (
      <div className="border-b border-gray-100">
        <button
          type="button"
          onClick={() => toggleGrupo(id)}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <span className="font-bold text-[#0097b2]">{titulo}</span>
          {aberto ? (
            <ChevronUp size={18} aria-hidden className="shrink-0 text-[#0097b2]" />
          ) : (
            <ChevronDown size={18} aria-hidden className="shrink-0 text-[#0097b2]" />
          )}
        </button>
        {aberto ? (
          <div>
            {itens.map((canal) => (
              <div key={canal.id} className="pl-4">
                {renderRow(canal)}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  if (loading) {
    return <div className="p-4 text-center text-gray-400">Carregando canais...</div>
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="min-h-0 flex-1 overflow-y-auto rounded-xl shadow-sm">
        {renderGrupo({ id: 'administracao', titulo: 'ADMINISTRAÇÃO', itens: part.administracao })}
        {renderGrupo({ id: 'empresas', titulo: 'EMPRESAS', itens: part.empresas })}
      </div>
    </div>
  )
}
