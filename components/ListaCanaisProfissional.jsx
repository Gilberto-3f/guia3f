'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ChevronDown, ChevronUp, Crown, Landmark, MessageCircle } from 'lucide-react'

/** @type {readonly string[]} */
const CATEGORIAS_PROFISSIONAIS = ['motorista_app', 'van', 'taxista', 'guia', 'anfitriao']

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

  const part = useMemo(() => {
    const administracao = canais.filter(
      (c) => c.tipo_publico === 'profissional' && (c.categoria === 'admin' || nomeNorm(c.nome) === 'FINANCEIRO'),
    )
    const profissionais = canais.filter(
      (c) =>
        c.tipo_publico === 'profissional' &&
        c.categoria != null &&
        CATEGORIAS_PROFISSIONAIS.includes(c.categoria),
    )
    return { administracao, profissionais }
  }, [canais])

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

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('canais')
        .select('id, nome, tipo_publico, categoria, ultima_mensagem_em, ordem_tipo, ordem_posicao')
        .eq('tipo_publico', 'profissional')
        .eq('ativo', true)

      if (error) throw error
      const lista = /** @type {Canal[]} */ (data ?? [])
      const filtrada = lista.filter((c) => {
        if (c.categoria === 'admin' || nomeNorm(c.nome) === 'FINANCEIRO') return true
        return c.categoria != null && CATEGORIAS_PROFISSIONAIS.includes(c.categoria)
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
        {renderGrupo({ id: 'profissionais', titulo: 'PROFISSIONAIS', itens: part.profissionais })}
      </div>
    </div>
  )
}
