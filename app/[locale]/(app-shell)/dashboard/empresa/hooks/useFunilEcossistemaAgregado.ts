'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  normalizarCategoriaProfissionalSlug,
  type CategoriaProfissionalFunil,
} from '../components/funil-conversao/categoriasProfissionalFunil'
import type { DadosFunilEcossistema, Periodo, RecomendacaoCategoriaAgregada } from '../types/dashboard.types'

function getDataLimite(periodo: Periodo): string | null {
  const now = new Date()
  if (periodo === 'hoje') {
    const inicio = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return inicio.toISOString()
  }
  const base = new Date()
  const d =
    periodo === '7d'
      ? new Date(base.setDate(base.getDate() - 7))
      : periodo === '30d'
        ? new Date(base.setDate(base.getDate() - 30))
        : periodo === '90d'
          ? new Date(base.setDate(base.getDate() - 90))
          : null
  return d ? d.toISOString() : null
}

function isTabelaInexistente(err: unknown): boolean {
  const e = err as { code?: string; message?: string; status?: number }
  if (e?.code === 'PGRST205') return true
  const msg = String(e?.message ?? '').toLowerCase()
  return msg.includes('could not find the table') || e?.status === 404
}

async function contar(
  builder: PromiseLike<{ count: number | null; error: unknown }>,
): Promise<number> {
  const { count, error } = await builder
  if (error) {
    if (isTabelaInexistente(error)) return 0
    throw error
  }
  return count ?? 0
}

function asCategorias(v: unknown) {
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string') as string[]
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v)
      if (Array.isArray(p)) return p.filter((x) => typeof x === 'string') as string[]
    } catch {
      // ignore
    }
  }
  return [] as string[]
}

function resolverCategoria(categorias: string[]): CategoriaProfissionalFunil {
  for (const c of categorias) {
    const hit = normalizarCategoriaProfissionalSlug(c)
    if (hit) return hit
  }
  return 'guias'
}

async function contarRecomendacoesAgregadas(dataLimite: string | null): Promise<number> {
  let q = supabase.from('recomendacoes').select('*', { count: 'exact', head: true })
  if (dataLimite) q = q.gte('created_at', dataLimite)
  return contar(q)
}

async function contarPaxAgregado(dataLimite: string | null): Promise<number> {
  let q = supabase
    .from('manifesto')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'confirmado')
  if (dataLimite) q = q.gte('created_at', dataLimite)
  return contar(q)
}

async function contarVendasAgregadas(dataLimite: string | null): Promise<number> {
  let qVendas = supabase
    .from('comissao')
    .select('*', { count: 'exact', head: true })
    .eq('tipo', 'venda_direta')
  if (dataLimite) qVendas = qVendas.gte('created_at', dataLimite)

  let qReservas = supabase.from('reservas').select('*', { count: 'exact', head: true })
  if (dataLimite) qReservas = qReservas.gte('created_at', dataLimite)

  const [vendas, reservas] = await Promise.all([contar(qVendas), contar(qReservas)])
  return vendas + reservas
}

async function buscarRecomendacoesPorCategoria(dataLimite: string | null): Promise<RecomendacaoCategoriaAgregada[]> {
  let q = supabase
    .from('recomendacoes')
    .select(
      `
      id,
      profissionais:profissional_id (categorias)
    `,
    )
  if (dataLimite) q = q.gte('created_at', dataLimite)

  const { data, error } = await q
  if (error) {
    if (isTabelaInexistente(error)) return []
    throw error
  }

  const agg: Record<CategoriaProfissionalFunil, number> = {
    apps: 0,
    vans: 0,
    guias: 0,
    taxistas: 0,
    anfitrioes: 0,
  }

  for (const row of (data ?? []) as unknown[]) {
    const r = row as Record<string, unknown>
    const prof = r.profissionais
    const profObj = prof && typeof prof === 'object' && !Array.isArray(prof) ? (prof as Record<string, unknown>) : null
    const categorias = profObj ? asCategorias(profObj.categorias) : []
    const cat = resolverCategoria(categorias)
    agg[cat] += 1
  }

  return Object.entries(agg).map(([categoria, total]) => ({ categoria, total }))
}

export function useFunilEcossistemaAgregado(periodo: Periodo) {
  const [dados, setDados] = useState<DadosFunilEcossistema | null>(null)
  const [recomendacoesPorCategoria, setRecomendacoesPorCategoria] = useState<RecomendacaoCategoriaAgregada[]>([])
  const [loading, setLoading] = useState(true)
  const [detalhesLoading, setDetalhesLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const detalhesCarregados = useRef(false)
  const dataLimite = useMemo(() => getDataLimite(periodo), [periodo])

  const fetchMetricas = useCallback(async () => {
    setLoading(true)
    setError(null)
    detalhesCarregados.current = false
    setRecomendacoesPorCategoria([])

    try {
      const [recomendacoes, pax, vendas] = await Promise.all([
        contarRecomendacoesAgregadas(dataLimite),
        contarPaxAgregado(dataLimite),
        contarVendasAgregadas(dataLimite),
      ])
      setDados({ recomendacoes, pax, vendas })
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar funil do ecossistema'))
      setDados(null)
    } finally {
      setLoading(false)
    }
  }, [dataLimite])

  const carregarDetalheRecomendacoes = useCallback(async () => {
    if (detalhesCarregados.current) return
    setDetalhesLoading(true)
    try {
      const cats = await buscarRecomendacoesPorCategoria(dataLimite)
      setRecomendacoesPorCategoria(cats)
      detalhesCarregados.current = true
    } catch {
      setRecomendacoesPorCategoria([])
    } finally {
      setDetalhesLoading(false)
    }
  }, [dataLimite])

  const obterDadosExportacao = useCallback(async () => {
    const cats = await buscarRecomendacoesPorCategoria(dataLimite).catch(() => [])
    return {
      funil_ecossistema_recomendacoes_categoria: cats,
    }
  }, [dataLimite])

  useEffect(() => {
    void fetchMetricas()
  }, [fetchMetricas])

  return {
    dados,
    recomendacoesPorCategoria,
    loading,
    detalhesLoading,
    error,
    carregarDetalheRecomendacoes,
    obterDadosExportacao,
  }
}
