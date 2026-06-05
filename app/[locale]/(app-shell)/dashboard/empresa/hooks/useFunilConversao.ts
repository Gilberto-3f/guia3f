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
      const { data: empresaRow, error: empErr } = await supabase
        .from('empresas')
        .select('usuario_id')
        .eq('id', empresaId)
        .maybeSingle()
      if (empErr) throw empErr

      const empresaUsuarioId =
        empresaRow && typeof empresaRow === 'object' && 'usuario_id' in empresaRow && empresaRow.usuario_id != null
          ? String(empresaRow.usuario_id)
          : null

      // 1. Visualizações (perfil_visitas → fallback log_visita)
      let visualizacoes = 0
      {
        let q = supabase
          .from('perfil_visitas')
          .select('*', { count: 'exact', head: true })
          .eq('tipo_alvo', 'empresa')
          .eq('empresa_id', empresaId)
        if (dataLimite) q = q.gte('visitado_em', dataLimite)
        const { count, error: pvErr } = await q
        if (!pvErr && count != null) {
          visualizacoes = count
        } else if (!pvErr || isTabelaInexistente(pvErr)) {
          let qLog = supabase.from('log_visita').select('*', { count: 'exact', head: true }).eq('empresa_id', empresaId)
          if (dataLimite) qLog = qLog.gte('created_at', dataLimite)
          visualizacoes = await contar(qLog)
        } else {
          throw pvErr
        }
      }

      // 2. Seguidores (redecontatos → usuario_id da empresa, não empresas.id)
      let seguidores = 0
      if (empresaUsuarioId) {
        let qSeg = supabase
          .from('redecontatos')
          .select('*', { count: 'exact', head: true })
          .eq('seguido_id', empresaUsuarioId)
          .eq('seguido_tipo', 'empresa')
        if (dataLimite) qSeg = qSeg.gte('created_at', dataLimite)
        seguidores = await contar(qSeg)
      }

      // 3. Recomendações
      let qRec = supabase.from('recomendacoes').select('*', { count: 'exact', head: true }).eq('empresa_id', empresaId)
      if (dataLimite) qRec = qRec.gte('created_at', dataLimite)
      const recomendacoes = await contar(qRec)

      // 4. PAX (manifesto confirmado)
      let qPax = supabase
        .from('manifesto')
        .select('*', { count: 'exact', head: true })
        .eq('empresa_destino_id', empresaId)
        .eq('status', 'confirmado')
      if (dataLimite) qPax = qPax.gte('created_at', dataLimite)
      const pax = await contar(qPax)

      // 5. Vendas (comissao)
      let qVendas = supabase
        .from('comissao')
        .select('*', { count: 'exact', head: true })
        .eq('empresa_id', empresaId)
        .eq('tipo', 'venda_direta')
      if (dataLimite) qVendas = qVendas.gte('created_at', dataLimite)
      const vendas = await contar(qVendas)

      setDados({
        visualizacoes,
        seguidores,
        recomendacoes,
        pax,
        vendas,
      })

      // 6. Recomendações por profissional
      let recAgrupadas: Record<string, RecomendacaoProfissional> = {}
      {
        let qRecProf = supabase
          .from('recomendacoes')
          .select(
            `
            profissional_id,
            profissionais:profissional_id (nome_completo, nome_usuario, categorias)
          `,
          )
          .eq('empresa_id', empresaId)
        if (dataLimite) qRecProf = qRecProf.gte('created_at', dataLimite)
        const { data: recData, error: recErr } = await qRecProf
        if (recErr && !isTabelaInexistente(recErr)) throw recErr
        if (!recErr && recData) {
          for (const rec of recData as unknown[]) {
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
        }
      }
      setRecomendacoesPorProfissional(Object.values(recAgrupadas).sort((a, b) => b.total - a.total))

      // 7. Top 5 PAX por profissional
      let paxAgrupadas: Record<string, PaxProfissional> = {}
      {
        let qTopPax = supabase
          .from('manifesto')
          .select(
            `
            profissional_id,
            profissionais:profissional_id (nome_completo, nome_usuario)
          `,
          )
          .eq('empresa_destino_id', empresaId)
          .eq('status', 'confirmado')
        if (dataLimite) qTopPax = qTopPax.gte('created_at', dataLimite)
        const { data: paxData, error: paxErr } = await qTopPax
        if (paxErr && !isTabelaInexistente(paxErr)) throw paxErr
        if (!paxErr && paxData) {
          for (const item of paxData as unknown[]) {
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
        }
      }
      setTopPax(Object.values(paxAgrupadas).sort((a, b) => b.total - a.total).slice(0, 5))
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar funil'))
      setDados(null)
      setRecomendacoesPorProfissional([])
      setTopPax([])
    } finally {
      setLoading(false)
    }
  }, [empresaId, dataLimite])

  useEffect(() => {
    void fetchDados()
  }, [fetchDados])

  return { dados, recomendacoesPorProfissional, topPax, loading, error, refetch: fetchDados }
}
