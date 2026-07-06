'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/** Contador leve para badge da pasta Espaço ADM / aba Empresas (ofertas de comissão pendentes). */
export function useComissaoOfertaContadores(enabled = true) {
  const [pendentes, setPendentes] = useState(0)

  const refetch = useCallback(async () => {
    if (!enabled) return
    try {
      const { count, error } = await supabase
        .from('comissao_oferta')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pendente')

      if (!error) setPendentes(count ?? 0)
    } catch {
      // mantém último valor
    }
  }, [enabled])

  useEffect(() => {
    void refetch()
    const onUpdate = () => void refetch()
    window.addEventListener('comissao-oferta-updated', onUpdate)

    const pollId = setInterval(() => {
      if (document.visibilityState === 'visible') void refetch()
    }, 60_000)

    return () => {
      window.removeEventListener('comissao-oferta-updated', onUpdate)
      clearInterval(pollId)
    }
  }, [refetch])

  return { pendentes, refetch }
}
