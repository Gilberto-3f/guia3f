'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { contaVerificadaDocumentacao } from '@/lib/contaVerificada'
import { normalizarCategoriaProfissionalSlug } from '../components/funil-conversao/categoriasProfissionalFunil'
import type {
  DadosFunil,
  PaxDetalhe,
  PaxProfissional,
  Periodo,
  RecomendacaoDetalhe,
  RecomendacaoProfissional,
  VendaDetalhe,
  VendaProfissional,
} from '../types/dashboard.types'

export type DetalheFunilEtapa = 'recomendacoes' | 'pax' | 'vendas'

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

function resolverCategoriaProfissional(categorias: string[]): string {
  for (const c of categorias) {
    const hit = normalizarCategoriaProfissionalSlug(c)
    if (hit) return hit
  }
  return 'guias'
}

function isColunaInexistente(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? '').toLowerCase()
  return msg.includes('column') && msg.includes('does not exist')
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

function pickFotoProfissional(prof: Record<string, unknown> | null): string | null {
  if (!prof) return null
  const perfil = prof.foto_perfil_url != null ? String(prof.foto_perfil_url).trim() : ''
  if (perfil) return perfil
  const legacy = prof.foto_url != null ? String(prof.foto_url).trim() : ''
  return legacy || null
}

const PROF_JOIN_FIELDS =
  'nome_completo, nome_usuario, foto_perfil_url, foto_url, categorias, docs_verificado, status'

function dadosCabecalhoProfissional(prof: Record<string, unknown> | null, pid: string) {
  return {
    profissional_id: pid,
    profissional_nome: prof?.nome_completo != null ? String(prof.nome_completo) : 'Profissional',
    profissional_username: prof?.nome_usuario != null ? String(prof.nome_usuario) : 'usuario',
    profissional_foto_url: pickFotoProfissional(prof),
    profissional_verificado: contaVerificadaDocumentacao('profissional', prof),
  }
}

async function contarVisualizacoes(empresaId: string, dataLimite: string | null): Promise<number> {
  let q = supabase
    .from('perfil_visitas')
    .select('*', { count: 'exact', head: true })
    .eq('tipo_alvo', 'empresa')
    .eq('empresa_id', empresaId)
  if (dataLimite) q = q.gte('visitado_em', dataLimite)
  const { count, error: pvErr } = await q
  if (!pvErr && count != null) return count
  if (!pvErr || isTabelaInexistente(pvErr)) {
    let qLog = supabase.from('log_visita').select('*', { count: 'exact', head: true }).eq('empresa_id', empresaId)
    if (dataLimite) qLog = qLog.gte('created_at', dataLimite)
    return contar(qLog)
  }
  throw pvErr
}

async function contarInteracoesPaginaEmpresa(
  empresaId: string,
  empresaUsuarioId: string | null,
  dataLimite: string | null,
): Promise<number> {
  let qAval = supabase.from('avaliacoes').select('*', { count: 'exact', head: true }).eq('empresa_id', empresaId)
  if (dataLimite) qAval = qAval.gte('created_at', dataLimite)

  if (!empresaUsuarioId) return contar(qAval)

  const [avaliacoes, postRes] = await Promise.all([
    contar(qAval),
    supabase
      .from('posts')
      .select('id, total_compartilhamentos')
      .eq('autor_id', empresaUsuarioId)
      .is('deleted_at', null),
  ])

  let total = avaliacoes
  const { data: postRows, error: postErr } = postRes
  if (postErr && !isTabelaInexistente(postErr)) throw postErr

  const postIds = (postRows ?? []).map((r) => String((r as { id: string }).id))
  if (postIds.length === 0) return total

  let qCurtPosts = supabase.from('curtidas').select('*', { count: 'exact', head: true }).in('post_id', postIds)
  if (dataLimite) qCurtPosts = qCurtPosts.gte('created_at', dataLimite)

  let qCom = supabase.from('comentarios').select('*', { count: 'exact', head: true }).in('post_id', postIds)
  if (dataLimite) qCom = qCom.gte('created_at', dataLimite)

  let qSalvo = supabase.from('item_salvo').select('*', { count: 'exact', head: true }).in('post_id', postIds)
  if (dataLimite) qSalvo = qSalvo.gte('salvo_em', dataLimite)

  let qRepost = supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .in('post_original_id', postIds)
    .is('deleted_at', null)
  if (dataLimite) qRepost = qRepost.gte('created_at', dataLimite)

  const [curtPosts, comentarios, salvos, reposts, comentarioRes] = await Promise.all([
    contar(qCurtPosts),
    contar(qCom),
    contar(qSalvo),
    contar(qRepost),
    supabase.from('comentarios').select('id').in('post_id', postIds),
  ])

  total += curtPosts + comentarios + salvos + reposts

  const { data: comentarioRows, error: comErr } = comentarioRes
  if (comErr && !isTabelaInexistente(comErr)) throw comErr
  const comentarioIds = (comentarioRows ?? []).map((r) => String((r as { id: string }).id))
  if (comentarioIds.length > 0) {
    let qCurtCom = supabase
      .from('curtidas')
      .select('*', { count: 'exact', head: true })
      .in('comentario_id', comentarioIds)
    if (dataLimite) qCurtCom = qCurtCom.gte('created_at', dataLimite)
    total += await contar(qCurtCom)
  }

  for (const row of postRows ?? []) {
    const r = row as { total_compartilhamentos?: number | null }
    const n =
      typeof r.total_compartilhamentos === 'number' ? r.total_compartilhamentos : Number(r.total_compartilhamentos) || 0
    if (n > 0) total += n
  }

  return total
}

async function contarRecomendacoes(empresaId: string, dataLimite: string | null): Promise<number> {
  let qRec = supabase.from('recomendacoes').select('*', { count: 'exact', head: true }).eq('empresa_id', empresaId)
  if (dataLimite) qRec = qRec.gte('created_at', dataLimite)
  return contar(qRec)
}

async function contarPax(empresaId: string, dataLimite: string | null): Promise<number> {
  let qPax = supabase
    .from('manifesto')
    .select('*', { count: 'exact', head: true })
    .eq('empresa_destino_id', empresaId)
    .eq('status', 'confirmado')
  if (dataLimite) qPax = qPax.gte('created_at', dataLimite)
  return contar(qPax)
}

async function contarVendas(empresaId: string, dataLimite: string | null): Promise<number> {
  let qVendas = supabase
    .from('comissao')
    .select('*', { count: 'exact', head: true })
    .eq('empresa_id', empresaId)
    .eq('tipo', 'venda_direta')
  if (dataLimite) qVendas = qVendas.gte('created_at', dataLimite)
  return contar(qVendas)
}

function normalizarWhatsappFinal(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).replace(/\D/g, '').trim()
  return s.length >= 4 ? s.slice(-4) : null
}

function normalizarWhatsappDdd(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).replace(/\D/g, '').trim()
  return s.length >= 2 ? s.slice(0, 2) : null
}

async function buscarRecomendacoesPorProfissional(
  empresaId: string,
  dataLimite: string | null,
): Promise<RecomendacaoProfissional[]> {
  const selectBase = `
      id,
      created_at,
      profissional_id,
      profissionais:profissional_id (${PROF_JOIN_FIELDS})
    `
  const selectComDdd = `
      id,
      created_at,
      turista_whatsapp_final,
      turista_whatsapp_ddd,
      profissional_id,
      profissionais:profissional_id (${PROF_JOIN_FIELDS})
    `
  const selectSoFinal = `
      id,
      created_at,
      turista_whatsapp_final,
      profissional_id,
      profissionais:profissional_id (${PROF_JOIN_FIELDS})
    `

  const queryRec = (select: string) => {
    let q = supabase.from('recomendacoes').select(select).eq('empresa_id', empresaId).order('created_at', { ascending: false })
    if (dataLimite) q = q.gte('created_at', dataLimite)
    return q
  }

  let recData: unknown[] | null = null
  let recErr: unknown = null

  for (const select of [selectComDdd, selectSoFinal, selectBase]) {
    const res = await queryRec(select)
    recData = res.data ?? null
    recErr = res.error
    if (!recErr) break
    const msg = String((recErr as { message?: string })?.message ?? '').toLowerCase()
    if (!isColunaInexistente(recErr) && !msg.includes('turista_whatsapp')) break
  }

  if (recErr && !isTabelaInexistente(recErr)) throw recErr

  const recAgrupadas: Record<string, RecomendacaoProfissional> = {}
  if (!recErr && recData) {
    for (const rec of recData as unknown[]) {
      const row = rec as Record<string, unknown>
      const pid = row.profissional_id != null ? String(row.profissional_id) : ''
      if (!pid) continue

      const prof = asProfRow(row.profissionais)
      const categorias = prof ? asCategorias(prof.categorias) : []
      const categoria = resolverCategoriaProfissional(categorias)

      const detalhe: RecomendacaoDetalhe = {
        id: row.id != null ? String(row.id) : `${pid}-${recAgrupadas[pid]?.detalhes.length ?? 0}`,
        created_at: row.created_at != null ? String(row.created_at) : new Date().toISOString(),
        turista_whatsapp_final: normalizarWhatsappFinal(row.turista_whatsapp_final),
        turista_whatsapp_ddd: normalizarWhatsappDdd(row.turista_whatsapp_ddd),
      }

      if (!recAgrupadas[pid]) {
        recAgrupadas[pid] = {
          ...dadosCabecalhoProfissional(prof, pid),
          categoria,
          total: 0,
          detalhes: [],
        }
      }
      recAgrupadas[pid].total += 1
      recAgrupadas[pid].detalhes.push(detalhe)
    }
  }

  return Object.values(recAgrupadas).sort((a, b) => b.total - a.total)
}

async function buscarPaxPorProfissional(empresaId: string, dataLimite: string | null): Promise<PaxProfissional[]> {
  let qPaxProf = supabase
    .from('manifesto')
    .select(
      `
      id,
      created_at,
      pax_qtd,
      profissional_id,
      profissionais:profissional_id (${PROF_JOIN_FIELDS})
    `,
    )
    .eq('empresa_destino_id', empresaId)
    .eq('status', 'confirmado')
    .order('created_at', { ascending: false })
  if (dataLimite) qPaxProf = qPaxProf.gte('created_at', dataLimite)
  const { data: paxData, error: paxErr } = await qPaxProf
  if (paxErr && !isTabelaInexistente(paxErr)) throw paxErr

  const paxAgrupadas: Record<string, PaxProfissional> = {}
  if (!paxErr && paxData) {
    for (const item of paxData as unknown[]) {
      const row = item as Record<string, unknown>
      const pid = row.profissional_id != null ? String(row.profissional_id) : ''
      if (!pid) continue

      const prof = asProfRow(row.profissionais)
      const categorias = prof ? asCategorias(prof.categorias) : []
      const categoria = resolverCategoriaProfissional(categorias)
      const paxQtd = typeof row.pax_qtd === 'number' ? row.pax_qtd : Number(row.pax_qtd) || 1

      const detalhe: PaxDetalhe = {
        id: row.id != null ? String(row.id) : `${pid}-${paxAgrupadas[pid]?.detalhes.length ?? 0}`,
        created_at: row.created_at != null ? String(row.created_at) : new Date().toISOString(),
        pax_qtd: paxQtd > 0 ? paxQtd : 1,
      }

      if (!paxAgrupadas[pid]) {
        paxAgrupadas[pid] = {
          ...dadosCabecalhoProfissional(prof, pid),
          categoria,
          total: 0,
          detalhes: [],
        }
      }
      paxAgrupadas[pid].total += detalhe.pax_qtd
      paxAgrupadas[pid].detalhes.push(detalhe)
    }
  }

  return Object.values(paxAgrupadas).sort((a, b) => b.total - a.total)
}

async function buscarVendasPorProfissional(
  empresaId: string,
  dataLimite: string | null,
): Promise<{ vendas: VendaProfissional[]; semProfissional: number }> {
  let qVendasProf = supabase
    .from('comissao')
    .select(
      `
      id,
      created_at,
      valor,
      profissional_id,
      profissionais:profissional_id (${PROF_JOIN_FIELDS})
    `,
    )
    .eq('empresa_id', empresaId)
    .eq('tipo', 'venda_direta')
    .order('created_at', { ascending: false })
  if (dataLimite) qVendasProf = qVendasProf.gte('created_at', dataLimite)
  const { data: vendasData, error: vendasErr } = await qVendasProf
  if (vendasErr && !isTabelaInexistente(vendasErr)) throw vendasErr

  const vendasAgrupadas: Record<string, VendaProfissional> = {}
  let semProfissional = 0

  if (!vendasErr && vendasData) {
    for (const item of vendasData as unknown[]) {
      const row = item as Record<string, unknown>
      const pid = row.profissional_id != null ? String(row.profissional_id) : ''
      if (!pid) {
        semProfissional += 1
        continue
      }

      const prof = asProfRow(row.profissionais)
      const categorias = prof ? asCategorias(prof.categorias) : []
      const categoria = resolverCategoriaProfissional(categorias)
      const valorRaw = row.valor
      const valor =
        typeof valorRaw === 'number'
          ? valorRaw
          : valorRaw != null && Number.isFinite(Number(valorRaw))
            ? Number(valorRaw)
            : null

      const detalhe: VendaDetalhe = {
        id: row.id != null ? String(row.id) : `${pid}-${vendasAgrupadas[pid]?.detalhes.length ?? 0}`,
        created_at: row.created_at != null ? String(row.created_at) : new Date().toISOString(),
        valor,
      }

      if (!vendasAgrupadas[pid]) {
        vendasAgrupadas[pid] = {
          ...dadosCabecalhoProfissional(prof, pid),
          categoria,
          total: 0,
          detalhes: [],
        }
      }
      vendasAgrupadas[pid].total += 1
      vendasAgrupadas[pid].detalhes.push(detalhe)
    }
  }

  return {
    vendas: Object.values(vendasAgrupadas).sort((a, b) => b.total - a.total),
    semProfissional,
  }
}

export function useFunilConversao(
  empresaId: string | null,
  empresaUsuarioId: string | null,
  periodo: Periodo,
) {
  const [dados, setDados] = useState<DadosFunil | null>(null)
  const [recomendacoesPorProfissional, setRecomendacoesPorProfissional] = useState<RecomendacaoProfissional[]>([])
  const [paxPorProfissional, setPaxPorProfissional] = useState<PaxProfissional[]>([])
  const [vendasPorProfissional, setVendasPorProfissional] = useState<VendaProfissional[]>([])
  const [vendasSemProfissional, setVendasSemProfissional] = useState(0)
  const [loading, setLoading] = useState(true)
  const [detalhesLoading, setDetalhesLoading] = useState<DetalheFunilEtapa | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const detalhesCarregados = useRef(new Set<DetalheFunilEtapa>())
  const prefetchEmAndamento = useRef(false)
  const dataLimite = useMemo(() => getDataLimite(periodo), [periodo])

  const prefetchTodosDetalhes = useCallback(async () => {
    if (!empresaId || prefetchEmAndamento.current) return
    prefetchEmAndamento.current = true
    try {
      const faltam = (['recomendacoes', 'pax', 'vendas'] as const).filter((e) => !detalhesCarregados.current.has(e))
      if (faltam.length === 0) return

      const resultados = await Promise.all(
        faltam.map(async (etapa) => {
          if (etapa === 'recomendacoes') {
            return { etapa, data: await buscarRecomendacoesPorProfissional(empresaId, dataLimite) }
          }
          if (etapa === 'pax') {
            return { etapa, data: await buscarPaxPorProfissional(empresaId, dataLimite) }
          }
          const { vendas, semProfissional } = await buscarVendasPorProfissional(empresaId, dataLimite)
          return { etapa, data: { vendas, semProfissional } }
        }),
      )

      for (const res of resultados) {
        if (res.etapa === 'recomendacoes') {
          setRecomendacoesPorProfissional(res.data as RecomendacaoProfissional[])
        } else if (res.etapa === 'pax') {
          setPaxPorProfissional(res.data as PaxProfissional[])
        } else {
          const payload = res.data as { vendas: VendaProfissional[]; semProfissional: number }
          setVendasPorProfissional(payload.vendas)
          setVendasSemProfissional(payload.semProfissional)
        }
        detalhesCarregados.current.add(res.etapa)
      }
    } catch {
      /* prefetch silencioso — abertura manual tenta de novo */
    } finally {
      prefetchEmAndamento.current = false
    }
  }, [dataLimite, empresaId])

  const resetDetalhes = useCallback(() => {
    detalhesCarregados.current.clear()
    prefetchEmAndamento.current = false
    setRecomendacoesPorProfissional([])
    setPaxPorProfissional([])
    setVendasPorProfissional([])
    setVendasSemProfissional(0)
    setDetalhesLoading(null)
  }, [])

  const fetchMetricas = useCallback(async () => {
    if (!empresaId) {
      setLoading(false)
      setDados(null)
      resetDetalhes()
      return
    }

    setLoading(true)
    setError(null)
    resetDetalhes()

    try {
      const [visualizacoes, interacoes, recomendacoes, pax, vendas] = await Promise.all([
        contarVisualizacoes(empresaId, dataLimite),
        contarInteracoesPaginaEmpresa(empresaId, empresaUsuarioId, dataLimite),
        contarRecomendacoes(empresaId, dataLimite),
        contarPax(empresaId, dataLimite),
        contarVendas(empresaId, dataLimite),
      ])

      setDados({ visualizacoes, interacoes, recomendacoes, pax, vendas })
      void prefetchTodosDetalhes()
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar funil'))
      setDados(null)
    } finally {
      setLoading(false)
    }
  }, [dataLimite, empresaId, empresaUsuarioId, prefetchTodosDetalhes, resetDetalhes])

  const carregarDetalhes = useCallback(
    async (etapa: DetalheFunilEtapa) => {
      if (!empresaId) return
      if (detalhesCarregados.current.has(etapa)) return

      setDetalhesLoading(etapa)
      try {
        if (etapa === 'recomendacoes') {
          const lista = await buscarRecomendacoesPorProfissional(empresaId, dataLimite)
          setRecomendacoesPorProfissional(lista)
        } else if (etapa === 'pax') {
          const lista = await buscarPaxPorProfissional(empresaId, dataLimite)
          setPaxPorProfissional(lista)
        } else {
          const { vendas, semProfissional } = await buscarVendasPorProfissional(empresaId, dataLimite)
          setVendasPorProfissional(vendas)
          setVendasSemProfissional(semProfissional)
        }
        detalhesCarregados.current.add(etapa)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Erro ao carregar relatório detalhado'))
      } finally {
        setDetalhesLoading((atual) => (atual === etapa ? null : atual))
      }
    },
    [dataLimite, empresaId],
  )

  useEffect(() => {
    void fetchMetricas()
  }, [fetchMetricas])

  return {
    dados,
    recomendacoesPorProfissional,
    paxPorProfissional,
    vendasPorProfissional,
    vendasSemProfissional,
    loading,
    detalhesLoading,
    error,
    carregarDetalhes,
    refetch: fetchMetricas,
  }
}
