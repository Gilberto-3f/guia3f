'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type PeriodoAdm = '7d' | '30d' | '90d' | '12m'

export type DadosAtendimentosCategoria = {
  categoria: string
  total: number
  percentual: number
}

export type DadosAtendimentosCidade = {
  cidade: string
  total: number
  percentual: number
}

export type Rota = {
  origem: string
  destino: string
  total: number
}

export type DadosComissoesCategoria = {
  categoria: string
  total: number
  percentual: number
}

export type ReceitaPlataforma = {
  total: number
  variacao: number
  breakdown: {
    comissoes: number
    assinaturas: number
    outros: number
  }
}

function getDataLimite(periodo: PeriodoAdm): string {
  const now = new Date()
  if (periodo === '7d') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  if (periodo === '30d') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  if (periodo === '90d') return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
  return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString()
}

export function useGraficosAdm(periodo: PeriodoAdm) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [atendimentosCategoria, setAtendimentosCategoria] = useState<DadosAtendimentosCategoria[]>([])
  const [atendimentosCidade, setAtendimentosCidade] = useState<DadosAtendimentosCidade[]>([])
  const [rotas, setRotas] = useState<Rota[]>([])
  const [comissoesCategoria, setComissoesCategoria] = useState<DadosComissoesCategoria[]>([])
  const [receita, setReceita] = useState<ReceitaPlataforma | null>(null)

  const fetchAtendimentosCategoria = useCallback(async () => {
    const since = getDataLimite(periodo)
    const { data, error: e } = await supabase.from('logs_atendimentos').select('profissional_id, tipo_servico').gte('data_atendimento', since)
    if (e || !data || data.length === 0) {
      setAtendimentosCategoria([
        { categoria: 'Guias', total: 0, percentual: 0 },
        { categoria: 'Taxistas', total: 0, percentual: 0 },
        { categoria: 'Apps', total: 0, percentual: 0 },
        { categoria: 'Vans', total: 0, percentual: 0 },
        { categoria: 'Anfitriões', total: 0, percentual: 0 },
      ])
      return
    }
    const map = new Map<string, number>()
    for (const row of data as Array<{ tipo_servico: string | null }>) {
      const key = String(row.tipo_servico ?? '').trim() || 'Outros'
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    const total = Array.from(map.values()).reduce((acc, v) => acc + v, 0) || 1
    setAtendimentosCategoria(
      Array.from(map.entries()).map(([categoria, v]) => ({
        categoria,
        total: v,
        percentual: (v / total) * 100,
      }))
    )
  }, [periodo])

  const fetchAtendimentosCidade = useCallback(async () => {
    const since = getDataLimite(periodo)
    const { data, error: e } = await supabase.from('logs_atendimentos').select('empresa_id').gte('data_atendimento', since)
    if (e || !data || data.length === 0) {
      setAtendimentosCidade([
        { cidade: 'Foz do Iguaçu', total: 0, percentual: 0 },
        { cidade: 'Ciudad del Este', total: 0, percentual: 0 },
        { cidade: 'Puerto Iguazu', total: 0, percentual: 0 },
      ])
      return
    }
    const ids = Array.from(
      new Set(
        (data as Array<{ empresa_id: string | null }>)
          .map((r) => r.empresa_id)
          .filter((v): v is string => typeof v === 'string' && v.length > 0)
      )
    )
    if (ids.length === 0) {
      setAtendimentosCidade([
        { cidade: 'Foz do Iguaçu', total: 0, percentual: 0 },
        { cidade: 'Ciudad del Este', total: 0, percentual: 0 },
        { cidade: 'Puerto Iguazu', total: 0, percentual: 0 },
      ])
      return
    }
    const { data: empresas } = await supabase.from('empresas').select('id, cidade').in('id', ids)
    const cidadeMap = new Map<string, number>()
    for (const row of empresas ?? []) {
      const cid = String((row as { cidade?: string | null }).cidade ?? 'Outro')
      cidadeMap.set(cid, (cidadeMap.get(cid) ?? 0) + 1)
    }
    const total = Array.from(cidadeMap.values()).reduce((a, v) => a + v, 0) || 1
    setAtendimentosCidade(
      Array.from(cidadeMap.entries()).map(([cidade, v]) => ({
        cidade,
        total: v,
        percentual: (v / total) * 100,
      }))
    )
  }, [periodo])

  const fetchRotas = useCallback(async () => {
    const since = getDataLimite(periodo)
    const { data, error: e } = await supabase.from('logs_rotas').select('origem, destino').gte('data_corrida', since)
    if (e || !data || data.length === 0) {
      setRotas([])
      return
    }
    const map = new Map<string, { origem: string; destino: string; total: number }>()
    for (const row of data as Array<{ origem: string; destino: string }>) {
      const key = `${row.origem}__${row.destino}`
      const entry = map.get(key) ?? { origem: row.origem, destino: row.destino, total: 0 }
      entry.total += 1
      map.set(key, entry)
    }
    setRotas(
      Array.from(map.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 15)
    )
  }, [periodo])

  const fetchComissoesCategoria = useCallback(async () => {
    const since = getDataLimite(periodo)
    const { data, error: e } = await supabase.from('comissao').select('empresa_id, valor').gte('created_at', since)
    if (e || !data || data.length === 0) {
      setComissoesCategoria([
        { categoria: 'Gastronomia', total: 0, percentual: 0 },
        { categoria: 'Atrativos', total: 0, percentual: 0 },
        { categoria: 'Lojas', total: 0, percentual: 0 },
        { categoria: 'Hospedagem', total: 0, percentual: 0 },
      ])
      return
    }
    const ids = Array.from(
      new Set(
        (data as Array<{ empresa_id: string | null }>)
          .map((r) => r.empresa_id)
          .filter((v): v is string => typeof v === 'string' && v.length > 0)
      )
    )
    const { data: empresas } = await supabase.from('empresas').select('id, categoria').in('id', ids)
    const catMap = new Map<string, number>()
    const empCat = new Map<string, string>()
    for (const row of empresas ?? []) {
      empCat.set(String((row as { id: string }).id), String((row as { categoria?: string | null }).categoria ?? 'Outros'))
    }
    for (const row of data as Array<{ empresa_id: string | null; valor: number | null }>) {
      const cid = row.empresa_id ? empCat.get(row.empresa_id) ?? 'Outros' : 'Outros'
      const v = Number(row.valor ?? 0)
      catMap.set(cid, (catMap.get(cid) ?? 0) + v)
    }
    const total = Array.from(catMap.values()).reduce((a, v) => a + v, 0) || 1
    setComissoesCategoria(
      Array.from(catMap.entries()).map(([categoria, v]) => ({
        categoria,
        total: v,
        percentual: (v / total) * 100,
      }))
    )
  }, [periodo])

  const fetchReceita = useCallback(async () => {
    const since = getDataLimite(periodo)
    const [{ data: coms }, { data: plans }] = await Promise.all([
      supabase.from('comissao').select('valor').gte('created_at', since),
      supabase.from('assinaturas').select('valor').gte('created_at', since),
    ])
    const totalCom = (coms ?? []).reduce((a, r) => a + Number((r as { valor?: number | null }).valor ?? 0), 0)
    const totalAss = (plans ?? []).reduce((a, r) => a + Number((r as { valor?: number | null }).valor ?? 0), 0)
    const total = totalCom + totalAss
    setReceita({
      total,
      variacao: 0,
      breakdown: {
        comissoes: totalCom,
        assinaturas: totalAss,
        outros: 0,
      },
    })
  }, [periodo])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([
        fetchAtendimentosCategoria(),
        fetchAtendimentosCidade(),
        fetchRotas(),
        fetchComissoesCategoria(),
        fetchReceita(),
      ])
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar gráficos'))
    } finally {
      setLoading(false)
    }
  }, [fetchAtendimentosCategoria, fetchAtendimentosCidade, fetchRotas, fetchComissoesCategoria, fetchReceita])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return { atendimentosCategoria, atendimentosCidade, rotas, comissoesCategoria, receita, loading, error, refetch: fetchData }
}

