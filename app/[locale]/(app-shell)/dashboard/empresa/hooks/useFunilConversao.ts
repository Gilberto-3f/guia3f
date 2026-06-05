'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { DadosFunil, PaxProfissional, Periodo, RecomendacaoProfissional } from '../types/dashboard.types'

function getDataLimite(periodo: Periodo): string | null {
  const now = new Date()
  if (periodo === 'hoje') {
    const inicio = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return inicio.toISOString()
  }
  const base = new Date(now.getTime())
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

function asProfRow(v: unknown) {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>
  return null
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

export function useFunilConversao(empresaId: string | null, periodo: Periodo) {
  const [dados, setDados] = useState<DadosFunil | null>(null)
  const [recomendacoesPorProfissional, setRecomendacoesPorProfissional] = useState<RecomendacaoProfissional[]>([])
  const [topPax, setTopPax] = useState<PaxProfissional[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const dataLimite = useMemo(() => getDataLimite(periodo), [periodo])

  const fetchDados = useCallback(async () => {
    if (!empresaId) {
      setLoading(false)
      setDados(null)
      setRecomendacoesPorProfissional([])
      setTopPax([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      // 1. Visualizações
      let queryVisitas = supabase.from('log_visita').select('*', { count: 'exact', head: true }).eq('empresa_id', empresaId)
      if (dataLimite) queryVisitas = queryVisitas.gte('created_at', dataLimite)
      const { count: visualizacoes, error: vErr } = await queryVisitas
      if (vErr) throw vErr

      // 2. Seguidores (redecontatos)
      let querySeguidores = supabase
        .from('redecontatos')
        .select('*', { count: 'exact', head: true })
        .eq('seguido_id', empresaId)
        .eq('seguido_tipo', 'empresa')
      if (dataLimite) querySeguidores = querySeguidores.gte('created_at', dataLimite)
      const { count: seguidores, error: sErr } = await querySeguidores
      if (sErr) throw sErr

      // 3. Recomendações
      let queryRecomendacoes = supabase
        .from('recomendacoes')
        .select('*', { count: 'exact', head: true })
        .eq('empresa_id', empresaId)
      if (dataLimite) queryRecomendacoes = queryRecomendacoes.gte('created_at', dataLimite)
      const { count: recomendacoes, error: rErr } = await queryRecomendacoes
      if (rErr) throw rErr

      // 4. PAX (manifesto)
      let queryPax = supabase
        .from('manifesto')
        .select('*', { count: 'exact', head: true })
        .eq('empresa_destino_id', empresaId)
        .eq('status', 'confirmado')
      if (dataLimite) queryPax = queryPax.gte('created_at', dataLimite)
      const { count: pax, error: pErr } = await queryPax
      if (pErr) throw pErr

      // 5. Vendas (comissao)
      let queryVendas = supabase
        .from('comissao')
        .select('*', { count: 'exact', head: true })
        .eq('empresa_id', empresaId)
        .eq('tipo', 'venda_direta')
      if (dataLimite) queryVendas = queryVendas.gte('created_at', dataLimite)
      const { count: vendas, error: cErr } = await queryVendas
      if (cErr) throw cErr

      setDados({
        visualizacoes: visualizacoes ?? 0,
        seguidores: seguidores ?? 0,
        recomendacoes: recomendacoes ?? 0,
        pax: pax ?? 0,
        vendas: vendas ?? 0,
      })

      // 6. Recomendações por profissional
      let queryRecPorProf = supabase
        .from('recomendacoes')
        .select(
          `
          profissional_id,
          profissionais:profissional_id (nome_completo, nome_usuario, categorias)
        `
        )
        .eq('empresa_id', empresaId)
      if (dataLimite) queryRecPorProf = queryRecPorProf.gte('created_at', dataLimite)
      const { data: recData, error: recErr } = await queryRecPorProf
      if (recErr) throw recErr

      const recAgrupadas: Record<string, RecomendacaoProfissional> = {}
      for (const rec of (recData ?? []) as unknown[]) {
        const row = rec as Record<string, unknown>
        const pid = row.profissional_id != null ? String(row.profissional_id) : ''
        if (!pid) continue

        const prof = asProfRow(row.profissionais)
        const categorias = prof ? asCategorias(prof.categorias) : []
        const categoria = categorias[0] ?? 'outros'

        if (!recAgrupadas[pid]) {
          recAgrupadas[pid] = {
            profissional_id: pid,
            profissional_nome: prof?.nome_completo != null ? String(prof.nome_completo) : 'Profissional',
            profissional_username: prof?.nome_usuario != null ? String(prof.nome_usuario) : 'usuario',
            categoria,
            total: 0,
          }
        }
        recAgrupadas[pid].total += 1
      }
      setRecomendacoesPorProfissional(Object.values(recAgrupadas).sort((a, b) => b.total - a.total))

      // 7. Top 5 PAX por profissional
      let queryTopPax = supabase
        .from('manifesto')
        .select(
          `
          profissional_id,
          profissionais:profissional_id (nome_completo, nome_usuario)
        `
        )
        .eq('empresa_destino_id', empresaId)
        .eq('status', 'confirmado')
      if (dataLimite) queryTopPax = queryTopPax.gte('created_at', dataLimite)
      const { data: paxData, error: paxErr } = await queryTopPax
      if (paxErr) throw paxErr

      const paxAgrupadas: Record<string, PaxProfissional> = {}
      for (const item of (paxData ?? []) as unknown[]) {
        const row = item as Record<string, unknown>
        const pid = row.profissional_id != null ? String(row.profissional_id) : ''
        if (!pid) continue
        const prof = asProfRow(row.profissionais)
        if (!paxAgrupadas[pid]) {
          paxAgrupadas[pid] = {
            profissional_id: pid,
            profissional_nome: prof?.nome_completo != null ? String(prof.nome_completo) : 'Profissional',
            profissional_username: prof?.nome_usuario != null ? String(prof.nome_usuario) : 'usuario',
            total: 0,
          }
        }
        paxAgrupadas[pid].total += 1
      }
      setTopPax(Object.values(paxAgrupadas).sort((a, b) => b.total - a.total).slice(0, 5))
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar funil'))
    } finally {
      setLoading(false)
    }
  }, [empresaId, dataLimite])

  useEffect(() => {
    void fetchDados()
  }, [fetchDados])

  return { dados, recomendacoesPorProfissional, topPax, loading, error, refetch: fetchDados }
}

