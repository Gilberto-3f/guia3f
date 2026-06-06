'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { GUIA_FUNIL_BADGE_EVENT } from '@/lib/dashboard-funil-badge-events'
import {
  contarNaoLidasFunilEmpresa,
  marcarEtapaFunilLida,
  obterLeituraFunilEmpresa,
  type ContagemNaoLidasFunil,
  type EtapaFunilNotif,
  type LeituraFunilEmpresa,
} from '@/lib/dashboardFunilBadge'

const LEITURA_VAZIA = {
  recomendacoes_visto_em: '1970-01-01T00:00:00.000Z',
  pax_visto_em: '1970-01-01T00:00:00.000Z',
  vendas_visto_em: '1970-01-01T00:00:00.000Z',
} satisfies LeituraFunilEmpresa

export function useFunilNotificacoes(empresaId: string | null, usuarioId: string | null) {
  const [contagens, setContagens] = useState<ContagemNaoLidasFunil>({
    total: 0,
    recomendacoes: 0,
    pax: 0,
    vendas: 0,
  })
  const [leitura, setLeitura] = useState<LeituraFunilEmpresa>(LEITURA_VAZIA)

  const refresh = useCallback(async () => {
    if (!empresaId || !usuarioId) {
      setContagens({ total: 0, recomendacoes: 0, pax: 0, vendas: 0 })
      setLeitura(LEITURA_VAZIA)
      return
    }

    const [c, l] = await Promise.all([
      contarNaoLidasFunilEmpresa(supabase, empresaId, usuarioId),
      obterLeituraFunilEmpresa(supabase, empresaId, usuarioId),
    ])
    setContagens(c)
    setLeitura(l)
  }, [empresaId, usuarioId])

  const marcarEtapaLida = useCallback(
    async (etapa: EtapaFunilNotif) => {
      if (!empresaId || !usuarioId) return
      await marcarEtapaFunilLida(supabase, empresaId, usuarioId, etapa)
      await refresh()
    },
    [empresaId, refresh, usuarioId],
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!empresaId || !usuarioId) return

    const onBadge = () => {
      void refresh()
    }
    window.addEventListener(GUIA_FUNIL_BADGE_EVENT, onBadge)

    const ch = supabase
      .channel(`funil-badge-${empresaId}-${usuarioId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'recomendacoes', filter: `empresa_id=eq.${empresaId}` },
        onBadge,
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'manifesto',
          filter: `empresa_destino_id=eq.${empresaId}`,
        },
        onBadge,
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comissao', filter: `empresa_id=eq.${empresaId}` },
        onBadge,
      )
      .subscribe()

    return () => {
      window.removeEventListener(GUIA_FUNIL_BADGE_EVENT, onBadge)
      void supabase.removeChannel(ch)
    }
  }, [empresaId, refresh, usuarioId])

  return { contagens, leitura, refresh, marcarEtapaLida }
}
