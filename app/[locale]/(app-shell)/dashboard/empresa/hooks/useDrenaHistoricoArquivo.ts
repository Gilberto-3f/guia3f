'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { labelMes } from '@/lib/drenaAnalytics'
import {
  montarPayloadArquivoMensal,
  type DrenaArquivoPayload,
} from '@/lib/drenaArquivoMensal'

export type MesArquivoOpcao = { ano: number; mes: number; label: string }

function opcoesUltimosMeses(qtd = 18): MesArquivoOpcao[] {
  const agora = new Date()
  const out: MesArquivoOpcao[] = []
  for (let i = 0; i < qtd; i++) {
    const d = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - i, 1))
    const ano = d.getUTCFullYear()
    const mes = d.getUTCMonth() + 1
    out.push({
      ano,
      mes,
      label: `${labelMes(mes)}/${ano}`,
    })
  }
  return out
}

export function useDrenaHistoricoArquivo() {
  const opcoes = opcoesUltimosMeses(18)
  const [ano, setAno] = useState(opcoes[0]?.ano ?? new Date().getFullYear())
  const [mes, setMes] = useState(opcoes[0]?.mes ?? new Date().getMonth() + 1)
  const [payload, setPayload] = useState<DrenaArquivoPayload | null>(null)
  const [fonte, setFonte] = useState<'arquivo' | 'live' | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: aErr } = await supabase
        .from('drena_arquivo_mensal')
        .select('payload, gerado_em')
        .eq('ano', ano)
        .eq('mes', mes)
        .maybeSingle()

      if (!aErr && data?.payload && typeof data.payload === 'object') {
        setPayload(data.payload as DrenaArquivoPayload)
        setFonte('arquivo')
        return
      }

      // Fallback: agrega o mês ao vivo (útil antes do cron / mês corrente)
      const live = await montarPayloadArquivoMensal(supabase, ano, mes)
      setPayload(live)
      setFonte('live')
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Erro ao carregar arquivo'))
      setPayload(null)
      setFonte(null)
    } finally {
      setLoading(false)
    }
  }, [ano, mes])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const selecionar = (a: number, m: number) => {
    setAno(a)
    setMes(m)
  }

  return {
    opcoes,
    ano,
    mes,
    selecionar,
    payload,
    fonte,
    loading,
    error,
    labelMes,
    refetch: carregar,
  }
}
