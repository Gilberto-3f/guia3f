'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Building2, Crown, Landmark } from 'lucide-react'

const NOMES_SEGMENTO = ['Gastronomia', 'Lojas', 'Atrativos', 'Hospedagem']

/**
 * @typedef {{
 *   id: string
 *   nome: string
 *   tipo_publico: string | null
 *   categoria: string | null
 *   ultima_mensagem_em: string | null
 * }} Canal
 */

/**
 * @param {{
 *   onSelectCanal: (c: Canal) => void
 *   canalSelecionadoId?: string
 *   leituraTick?: number
 * }} props
 */
export default function ListaCanaisProfissional({ onSelectCanal, canalSelecionadoId, leituraTick = 0 }) {
  const [fixos, setFixos] = useState(/** @type {Canal[]} */ ([]))
  const [segmentos, setSegmentos] = useState(/** @type {Canal[]} */ ([]))
  const [badges, setBadges] = useState(/** @type {Record<string, boolean>} */ ({}))
  const [loading, setLoading] = useState(true)

  const idsMonitor = useMemo(() => {
    const ids = [...fixos.map((c) => c.id), ...segmentos.map((c) => c.id)]
    return [...new Set(ids)]
  }, [fixos, segmentos])

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [rFix, rSeg] = await Promise.all([
        supabase
          .from('canais')
          .select('id, nome, tipo_publico, categoria, ultima_mensagem_em')
          .eq('tipo_publico', 'profissional')
          .eq('ativo', true)
          .in('nome', ['ADM', 'Financeiro'])
          .order('ordem_posicao', { ascending: true }),
        supabase
          .from('canais')
          .select('id, nome, tipo_publico, categoria, ultima_mensagem_em')
          .eq('tipo_publico', 'empresa')
          .eq('ativo', true)
          .in('nome', NOMES_SEGMENTO),
      ])

      if (rFix.error) throw rFix.error
      if (rSeg.error) throw rSeg.error

      const f = /** @type {Canal[]} */ (rFix.data ?? [])
      const seg = /** @type {Canal[]} */ (rSeg.data ?? [])
      seg.sort((a, b) => {
        const ta = a.ultima_mensagem_em ? new Date(a.ultima_mensagem_em).getTime() : 0
        const tb = b.ultima_mensagem_em ? new Date(b.ultima_mensagem_em).getTime() : 0
        if (tb !== ta) return tb - ta
        return NOMES_SEGMENTO.indexOf(a.nome) - NOMES_SEGMENTO.indexOf(b.nome)
      })

      setFixos(f)
      setSegmentos(seg)

      const { data: badgeRows, error: badgeErr } = await supabase.rpc('profissional_badges_segmentos_empresa')
      if (badgeErr) {
        console.warn('Badges segmento (RPC):', badgeErr)
        setBadges({})
      } else {
        const map = /** @type {Record<string, boolean>} */ ({})
        for (const row of badgeRows ?? []) {
          const id = row?.canal_id != null ? String(row.canal_id) : ''
          if (id) map[id] = Boolean(row.tem_badge)
        }
        setBadges(map)
      }
    } catch (e) {
      console.error('Erro ao carregar canais profissional:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar, leituraTick])

  useEffect(() => {
    if (idsMonitor.length === 0) return

    const ch = supabase.channel('lista-canais-prof-mensagens')
    for (const canalId of idsMonitor) {
      ch.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensagens_canal', filter: `canal_id=eq.${canalId}` },
        () => {
          void carregar()
        }
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
    if (canal.nome === 'ADM') return Crown
    if (canal.nome === 'Financeiro') return Landmark
    return Building2
  }

  /**
   * @param {Canal} canal
   * @param {boolean} mostrarBadgeEmpresa
   */
  function renderRow(canal, mostrarBadgeEmpresa) {
    const Icon = getIcon(canal)
    const isActive = canalSelecionadoId === canal.id
    const dot = mostrarBadgeEmpresa && badges[canal.id] === true
    return (
      <button
        key={canal.id}
        type="button"
        onClick={() => onSelectCanal(canal)}
        className={`relative flex w-full items-center gap-3 border-b border-gray-100 p-4 text-left transition-colors ${
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
        <div className="min-w-0 flex-1 pr-8">
          <h3 className="font-medium text-gray-800">{canal.nome}</h3>
        </div>
        {dot ? (
          <span
            className="absolute right-3 top-1/2 h-2.5 w-2.5 shrink-0 -translate-y-1/2 rounded-full bg-red-500 ring-2 ring-white"
            aria-label="Novidade"
          />
        ) : null}
      </button>
    )
  }

  if (loading) {
    return <div className="p-4 text-center text-gray-400">Carregando canais...</div>
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {fixos.map((c) => renderRow(c, false))}
        <div className="border-t border-gray-200 bg-gray-50 py-1" role="separator" aria-hidden />
        {segmentos.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-400">Segmentos em configuração.</div>
        ) : (
          segmentos.map((c) => renderRow(c, true))
        )}
      </div>
    </div>
  )
}
