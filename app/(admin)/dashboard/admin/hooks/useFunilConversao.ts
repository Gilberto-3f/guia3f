'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type DadosFunil = {
  empresa_id: string
  empresa_nome: string
  visualizacoes: number
  seguidores: number
  recomendacoes: number
  pax: number
  vendas: number
  conversao_seguidores: number
  conversao_recomendacoes: number
  conversao_pax: number
  conversao_vendas: number
}

export type FunilPeriodo = '7d' | '30d' | '90d'

function getDataLimite(periodo: FunilPeriodo): string {
  const now = new Date()
  if (periodo === '7d') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  if (periodo === '30d') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
}

async function safeCount(
  table: string,
  build: (q: ReturnType<typeof supabase.from>) => ReturnType<typeof supabase.from>
): Promise<number> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const base = supabase.from(table as any) as any
    const q = build(base).select('*', { count: 'exact', head: true })
    const { count, error } = await q
    if (error) return 0
    return count ?? 0
  } catch {
    return 0
  }
}

export function useFunilConversao(empresaId: string | null, periodo: FunilPeriodo) {
  const [dados, setDados] = useState<DadosFunil | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchDados = useCallback(async () => {
    if (!empresaId) {
      setDados(null)
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    const since = getDataLimite(periodo)

    try {
      // Empresa (nome + usuario_id para followers)
      const { data: empresa, error: empErr } = await supabase
        .from('empresas')
        .select('id, nome_fantasia, usuario_id')
        .eq('id', empresaId)
        .maybeSingle()

      if (empErr) throw empErr

      const empresaNome = empresa?.nome_fantasia ?? ''
      const empresaUsuarioId = (empresa as { usuario_id?: string | null } | null)?.usuario_id ?? null

      // Funil (tabelas podem não existir ainda → fallback 0)
      const visualizacoes = await safeCount('log_visita', (q) => q.eq('empresa_id', empresaId).gte('created_at', since))

      const seguidores = empresaUsuarioId
        ? await safeCount('redecontatos', (q) =>
            q.eq('seguido_id', empresaUsuarioId).eq('seguido_tipo', 'empresa').gte('created_at', since)
          )
        : 0

      const recomendacoes = await safeCount('recomendacoes', (q) => q.eq('empresa_id', empresaId).gte('created_at', since))

      const pax = await safeCount('manifesto', (q) =>
        q.eq('empresa_destino_id', empresaId).eq('status', 'confirmado').gte('created_at', since)
      )

      const vendas = await safeCount('comissoes', (q) =>
        q.eq('empresa_id', empresaId).eq('tipo', 'venda_direta').gte('created_at', since)
      )

      const visualizacoesVal = visualizacoes || 0
      const seguidoresVal = seguidores || 0
      const recomendacoesVal = recomendacoes || 0
      const paxVal = pax || 0
      const vendasVal = vendas || 0

      setDados({
        empresa_id: empresaId,
        empresa_nome: empresaNome,
        visualizacoes: visualizacoesVal,
        seguidores: seguidoresVal,
        recomendacoes: recomendacoesVal,
        pax: paxVal,
        vendas: vendasVal,
        conversao_seguidores: visualizacoesVal ? (seguidoresVal / visualizacoesVal) * 100 : 0,
        conversao_recomendacoes: seguidoresVal ? (recomendacoesVal / seguidoresVal) * 100 : 0,
        conversao_pax: recomendacoesVal ? (paxVal / recomendacoesVal) * 100 : 0,
        conversao_vendas: paxVal ? (vendasVal / paxVal) * 100 : 0,
      })
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar funil'))
      setDados(null)
    } finally {
      setLoading(false)
    }
  }, [empresaId, periodo])

  useEffect(() => {
    void fetchDados()
  }, [fetchDados])

  return { dados, loading, error, refetch: fetchDados }
}

