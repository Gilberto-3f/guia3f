'use client'

import { useCallback, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type PlanoId = 'BASICO' | 'PREMIUM' | 'ENTERPRISE'

export interface Plano {
  nome: PlanoId
  valor: number
  recursos: {
    fotos: number
    publicidade: boolean
    estatisticas: boolean
    suporte_prioritario: boolean
  }
}

export function usePlanos(empresaId: string | null) {
  const [solicitando, setSolicitando] = useState(false)

  const planos: Plano[] = useMemo(
    () => [
      {
        nome: 'BASICO',
        valor: 97,
        recursos: { fotos: 10, publicidade: false, estatisticas: false, suporte_prioritario: false },
      },
      {
        nome: 'PREMIUM',
        valor: 197,
        recursos: { fotos: 30, publicidade: true, estatisticas: true, suporte_prioritario: false },
      },
      {
        nome: 'ENTERPRISE',
        valor: 497,
        recursos: { fotos: 100, publicidade: true, estatisticas: true, suporte_prioritario: true },
      },
    ],
    []
  )

  const solicitarMudanca = useCallback(
    async (tipo: 'upgrade' | 'downgrade', plano: PlanoId) => {
      if (!empresaId) return
      setSolicitando(true)
      try {
        const texto = `[PLANO] Solicitação de ${tipo.toUpperCase()} para ${plano}`
        const { error } = await supabase.from('mensagens_chat_adm').insert({
          empresa_id: empresaId,
          mensagem: texto,
          lida_admin: false,
        })
        if (error) throw error
      } finally {
        setSolicitando(false)
      }
    },
    [empresaId]
  )

  return useMemo(() => ({ planos, solicitando, solicitarMudanca }), [planos, solicitando, solicitarMudanca])
}

