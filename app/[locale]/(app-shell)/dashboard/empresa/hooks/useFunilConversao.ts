'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
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

async function contarInteracoesPaginaEmpresa(
  empresaId: string,
  empresaUsuarioId: string | null,
  dataLimite: string | null,
): Promise<number> {
  let total = 0

  let qAval = supabase.from('avaliacoes').select('*', { count: 'exact', head: true }).eq('empresa_id', empresaId)
  if (dataLimite) qAval = qAval.gte('created_at', dataLimite)
  total += await contar(qAval)

  if (!empresaUsuarioId) return total

  const { data: postRows, error: postErr } = await supabase
    .from('posts')
    .select('id, total_compartilhamentos')
    .eq('autor_id', empresaUsuarioId)
    .is('deleted_at', null)
  if (postErr && !isTabelaInexistente(postErr)) throw postErr

  const postIds = (postRows ?? []).map((r) => String((r as { id: string }).id))
  if (postIds.length === 0) return total

  let qCurtPosts = supabase.from('curtidas').select('*', { count: 'exact', head: true }).in('post_id', postIds)
  if (dataLimite) qCurtPosts = qCurtPosts.gte('created_at', dataLimite)
  total += await contar(qCurtPosts)

  let qCom = supabase.from('comentarios').select('*', { count: 'exact', head: true }).in('post_id', postIds)
  if (dataLimite) qCom = qCom.gte('created_at', dataLimite)
  total += await contar(qCom)

  let qSalvo = supabase.from('item_salvo').select('*', { count: 'exact', head: true }).in('post_id', postIds)
  if (dataLimite) qSalvo = qSalvo.gte('salvo_em', dataLimite)
  total += await contar(qSalvo)

  const { data: comentarioRows, error: comErr } = await supabase.from('comentarios').select('id').in('post_id', postIds)
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

  let qRepost = supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .in('post_original_id', postIds)
    .is('deleted_at', null)
  if (dataLimite) qRepost = qRepost.gte('created_at', dataLimite)
  total += await contar(qRepost)

  // Compartilhamentos: soma do contador acumulado nos posts (sem log por evento com data).
  for (const row of postRows ?? []) {
    const r = row as { total_compartilhamentos?: number | null }
    const n =
      typeof r.total_compartilhamentos === 'number' ? r.total_compartilhamentos : Number(r.total_compartilhamentos) || 0
    if (n > 0) total += n
  }

  return total
}

function pickFotoProfissional(prof: Record<string, unknown> | null): string | null {
  if (!prof) return null
  const perfil = prof.foto_perfil_url != null ? String(prof.foto_perfil_url).trim() : ''
  if (perfil) return perfil
  const legacy = prof.foto_url != null ? String(prof.foto_url).trim() : ''
  return legacy || null
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
  const [paxPorProfissional, setPaxPorProfissional] = useState<PaxProfissional[]>([])
  const [vendasPorProfissional, setVendasPorProfissional] = useState<VendaProfissional[]>([])
  const [vendasSemProfissional, setVendasSemProfissional] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const dataLimite = useMemo(() => getDataLimite(periodo), [periodo])

  const fetchDados = useCallback(async () => {
    if (!empresaId) {
      setLoading(false)
      setDados(null)
      setRecomendacoesPorProfissional([])
      setPaxPorProfissional([])
      setVendasPorProfissional([])
      setVendasSemProfissional(0)
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

      // 2. Interações na página (curtidas, comentários, reposts, avaliações, salvos, compartilhamentos)
      const interacoes = await contarInteracoesPaginaEmpresa(empresaId, empresaUsuarioId, dataLimite)

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
        interacoes,
        recomendacoes,
        pax,
        vendas,
      })

      // 6. Recomendações por profissional (com detalhes individuais)
      let recAgrupadas: Record<string, RecomendacaoProfissional> = {}
      {
        const selectComWhatsapp = `
            id,
            created_at,
            turista_whatsapp_final,
            profissional_id,
            profissionais:profissional_id (nome_completo, nome_usuario, foto_perfil_url, foto_url, categorias)
          `
        const selectSemWhatsapp = `
            id,
            created_at,
            profissional_id,
            profissionais:profissional_id (nome_completo, nome_usuario, foto_perfil_url, foto_url, categorias)
          `

        let qRecProf = supabase
          .from('recomendacoes')
          .select(selectComWhatsapp)
          .eq('empresa_id', empresaId)
          .order('created_at', { ascending: false })
        if (dataLimite) qRecProf = qRecProf.gte('created_at', dataLimite)
        let { data: recData, error: recErr } = await qRecProf

        if (recErr && (isColunaInexistente(recErr) || String(recErr.message ?? '').includes('turista_whatsapp_final'))) {
          let qFallback = supabase
            .from('recomendacoes')
            .select(selectSemWhatsapp)
            .eq('empresa_id', empresaId)
            .order('created_at', { ascending: false })
          if (dataLimite) qFallback = qFallback.gte('created_at', dataLimite)
          const res = await qFallback
          recData = res.data
          recErr = res.error
        }

        if (recErr && !isTabelaInexistente(recErr)) throw recErr
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
              turista_whatsapp_final:
                row.turista_whatsapp_final != null ? String(row.turista_whatsapp_final) : null,
            }

            if (!recAgrupadas[pid]) {
              recAgrupadas[pid] = {
                profissional_id: pid,
                profissional_nome: prof?.nome_completo != null ? String(prof.nome_completo) : 'Profissional',
                profissional_username: prof?.nome_usuario != null ? String(prof.nome_usuario) : 'usuario',
                profissional_foto_url: pickFotoProfissional(prof),
                categoria,
                total: 0,
                detalhes: [],
              }
            }
            recAgrupadas[pid].total += 1
            recAgrupadas[pid].detalhes.push(detalhe)
          }
        }
      }
      setRecomendacoesPorProfissional(Object.values(recAgrupadas).sort((a, b) => b.total - a.total))

      // 7. PAX por profissional (com detalhes individuais)
      let paxAgrupadas: Record<string, PaxProfissional> = {}
      {
        let qPaxProf = supabase
          .from('manifesto')
          .select(
            `
            id,
            created_at,
            pax_qtd,
            profissional_id,
            profissionais:profissional_id (nome_completo, nome_usuario, foto_perfil_url, foto_url, categorias)
          `,
          )
          .eq('empresa_destino_id', empresaId)
          .eq('status', 'confirmado')
          .order('created_at', { ascending: false })
        if (dataLimite) qPaxProf = qPaxProf.gte('created_at', dataLimite)
        const { data: paxData, error: paxErr } = await qPaxProf
        if (paxErr && !isTabelaInexistente(paxErr)) throw paxErr
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
                profissional_id: pid,
                profissional_nome: prof?.nome_completo != null ? String(prof.nome_completo) : 'Profissional',
                profissional_username: prof?.nome_usuario != null ? String(prof.nome_usuario) : 'usuario',
                profissional_foto_url: pickFotoProfissional(prof),
                categoria,
                total: 0,
                detalhes: [],
              }
            }
            paxAgrupadas[pid].total += detalhe.pax_qtd
            paxAgrupadas[pid].detalhes.push(detalhe)
          }
        }
      }
      setPaxPorProfissional(Object.values(paxAgrupadas).sort((a, b) => b.total - a.total))

      // 8. Vendas por profissional (com detalhes individuais)
      let vendasAgrupadas: Record<string, VendaProfissional> = {}
      let semProfissional = 0
      {
        let qVendasProf = supabase
          .from('comissao')
          .select(
            `
            id,
            created_at,
            valor,
            profissional_id,
            profissionais:profissional_id (nome_completo, nome_usuario, foto_perfil_url, foto_url, categorias)
          `,
          )
          .eq('empresa_id', empresaId)
          .eq('tipo', 'venda_direta')
          .order('created_at', { ascending: false })
        if (dataLimite) qVendasProf = qVendasProf.gte('created_at', dataLimite)
        const { data: vendasData, error: vendasErr } = await qVendasProf
        if (vendasErr && !isTabelaInexistente(vendasErr)) throw vendasErr
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
                profissional_id: pid,
                profissional_nome: prof?.nome_completo != null ? String(prof.nome_completo) : 'Profissional',
                profissional_username: prof?.nome_usuario != null ? String(prof.nome_usuario) : 'usuario',
                profissional_foto_url: pickFotoProfissional(prof),
                categoria,
                total: 0,
                detalhes: [],
              }
            }
            vendasAgrupadas[pid].total += 1
            vendasAgrupadas[pid].detalhes.push(detalhe)
          }
        }
      }
      setVendasPorProfissional(Object.values(vendasAgrupadas).sort((a, b) => b.total - a.total))
      setVendasSemProfissional(semProfissional)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar funil'))
      setDados(null)
      setRecomendacoesPorProfissional([])
      setPaxPorProfissional([])
      setVendasPorProfissional([])
      setVendasSemProfissional(0)
    } finally {
      setLoading(false)
    }
  }, [empresaId, dataLimite])

  useEffect(() => {
    void fetchDados()
  }, [fetchDados])

  return {
    dados,
    recomendacoesPorProfissional,
    paxPorProfissional,
    vendasPorProfissional,
    vendasSemProfissional,
    loading,
    error,
    refetch: fetchDados,
  }
}
