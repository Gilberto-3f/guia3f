'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  GUIA_FUNIL_BADGE_EVENT,
  notificarBadgeFunil,
  notificarMetricasFunil,
} from '@/lib/dashboard-funil-badge-events'
import {
  contarNaoLidasFunilEmpresa,
  marcarEtapaFunilLida,
  obterLeituraFunilEmpresa,
  type ContagemNaoLidasFunil,
  type EtapaFunilNotif,
  type LeituraFunilEmpresa,
} from '@/lib/dashboardFunilBadge'
import { subscribeRecomendacoesEmpresa } from '@/lib/funilRecomendacoesRealtime'

const LEITURA_VAZIA = {
  recomendacoes_visto_em: '1970-01-01T00:00:00.000Z',
  pax_visto_em: '1970-01-01T00:00:00.000Z',
  vendas_visto_em: '1970-01-01T00:00:00.000Z',
} satisfies LeituraFunilEmpresa

export function useFunilNotificacoes(empresaId: string | null) {
  const [authUserId, setAuthUserId] = useState<string | null>(null)
  const [contagens, setContagens] = useState<ContagemNaoLidasFunil>({
    total: 0,
    recomendacoes: 0,
    pax: 0,
    vendas: 0,
  })
  const [leitura, setLeitura] = useState<LeituraFunilEmpresa>(LEITURA_VAZIA)

  useEffect(() => {
    let cancelled = false

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) setAuthUserId(session?.user?.id ?? null)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUserId(session?.user?.id ?? null)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const refresh = useCallback(async () => {
    if (!empresaId || !authUserId) {
      setContagens({ total: 0, recomendacoes: 0, pax: 0, vendas: 0 })
      setLeitura(LEITURA_VAZIA)
      return
    }

    const [c, l] = await Promise.all([
      contarNaoLidasFunilEmpresa(supabase, empresaId, authUserId),
      obterLeituraFunilEmpresa(supabase, empresaId, authUserId),
    ])
    setContagens(c)
    setLeitura(l)
  }, [authUserId, empresaId])

  const marcarEtapaLida = useCallback(
    async (etapa: EtapaFunilNotif) => {
      if (!empresaId || !authUserId) return

      const agora = new Date().toISOString()

      setLeitura((prev) => ({
        ...prev,
        ...(etapa === 'recomendacoes' ? { recomendacoes_visto_em: agora } : {}),
        ...(etapa === 'pax' ? { pax_visto_em: agora } : {}),
        ...(etapa === 'vendas' ? { vendas_visto_em: agora } : {}),
      }))

      setContagens((prev) => {
        const next = {
          recomendacoes: etapa === 'recomendacoes' ? 0 : prev.recomendacoes,
          pax: etapa === 'pax' ? 0 : prev.pax,
          vendas: etapa === 'vendas' ? 0 : prev.vendas,
        }
        const total = next.recomendacoes + next.pax + next.vendas
        notificarBadgeFunil({ total, etapa })
        return { ...next, total }
      })

      await marcarEtapaFunilLida(supabase, empresaId, authUserId, etapa)
    },
    [authUserId, empresaId],
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!empresaId || !authUserId) return

    const onBadgeEvento = (event: Event) => {
      const detail = (event as CustomEvent<{ total?: number; etapa?: EtapaFunilNotif }>).detail
      if (detail?.etapa) {
        setContagens((prev) => {
          const next = {
            recomendacoes: detail.etapa === 'recomendacoes' ? 0 : prev.recomendacoes,
            pax: detail.etapa === 'pax' ? 0 : prev.pax,
            vendas: detail.etapa === 'vendas' ? 0 : prev.vendas,
          }
          return { ...next, total: next.recomendacoes + next.pax + next.vendas }
        })
        return
      }
      if (typeof detail?.total === 'number' && Number.isFinite(detail.total)) return
      void refresh()
    }
    let debounceId: ReturnType<typeof setTimeout> | null = null
    const onBadgeRealtime = (avisarMetricas = false) => {
      if (debounceId) clearTimeout(debounceId)
      debounceId = setTimeout(() => {
        debounceId = null
        void refresh()
        notificarBadgeFunil()
        if (avisarMetricas) notificarMetricasFunil()
      }, 200)
    }
    window.addEventListener(GUIA_FUNIL_BADGE_EVENT, onBadgeEvento)

    const chRec = subscribeRecomendacoesEmpresa(
      supabase,
      empresaId,
      `funil-badge-rec-${empresaId}-${authUserId}`,
      () => onBadgeRealtime(true),
    )

    const chExtra = supabase
      .channel(`funil-badge-extra-${empresaId}-${authUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'manifesto',
          filter: `empresa_destino_id=eq.${empresaId}`,
        },
        () => onBadgeRealtime(false),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comissao', filter: `empresa_id=eq.${empresaId}` },
        () => onBadgeRealtime(false),
      )
      .subscribe()

    return () => {
      window.removeEventListener(GUIA_FUNIL_BADGE_EVENT, onBadgeEvento)
      if (debounceId) clearTimeout(debounceId)
      void supabase.removeChannel(chRec)
      void supabase.removeChannel(chExtra)
    }
  }, [authUserId, empresaId, refresh])

  return { contagens, leitura, refresh, marcarEtapaLida }
}
