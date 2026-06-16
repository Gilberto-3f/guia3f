import type { SupabaseClient } from '@supabase/supabase-js'
import { contaVerificadaDocumentacao } from '@/lib/contaVerificada'
import type { RecomendacaoDetalhe } from '@/app/[locale]/(app-shell)/dashboard/empresa/types/dashboard.types'

export type PeriodoRecomendacoesProf = 'mes' | '30d' | '90d'

export type RecomendacaoEmpresaHistorico = {
  empresa_id: string
  empresa_nome: string
  empresa_username: string
  empresa_foto_url: string | null
  empresa_verificado: boolean
  categoria: string
  total: number
  detalhes: RecomendacaoDetalhe[]
}

const EMP_JOIN_FIELDS = 'nome_fantasia, nome_usuario, foto_url, categoria, docs_verificado, status'

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

function asEmpRow(v: unknown) {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>
  return null
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

function normalizarCanalRecomendacao(v: unknown): 'whatsapp' | 'email' | null {
  const s = String(v ?? '').trim().toLowerCase()
  if (s === 'email') return 'email'
  if (s === 'whatsapp') return 'whatsapp'
  return null
}

function normalizarEmailPrefix(v: unknown): string | null {
  if (v == null) return null
  const s = String(v)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 5)
  return s || null
}

export function getDataLimiteRecomendacoesProf(periodo: PeriodoRecomendacoesProf): string | null {
  const now = new Date()
  if (periodo === 'mes') {
    const inicio = new Date(now.getFullYear(), now.getMonth(), 1)
    return inicio.toISOString()
  }
  const base = new Date(now.getTime())
  const d =
    periodo === '30d'
      ? new Date(base.setDate(base.getDate() - 30))
      : periodo === '90d'
        ? new Date(base.setDate(base.getDate() - 90))
        : null
  return d ? d.toISOString() : null
}

function dadosCabecalhoEmpresa(emp: Record<string, unknown> | null, eid: string) {
  return {
    empresa_id: eid,
    empresa_nome: emp?.nome_fantasia != null ? String(emp.nome_fantasia) : 'Empresa',
    empresa_username: emp?.nome_usuario != null ? String(emp.nome_usuario) : 'empresa',
    empresa_foto_url: emp?.foto_url != null ? String(emp.foto_url) : null,
    empresa_verificado: contaVerificadaDocumentacao('empresa', emp),
    categoria: emp?.categoria != null ? String(emp.categoria) : '',
  }
}

/** Recomendações do profissional agrupadas por empresa (mesma fonte do funil da empresa). */
export async function buscarRecomendacoesPorEmpresaParaProfissional(
  supabase: SupabaseClient,
  profissionalId: string,
  dataLimite: string | null,
): Promise<RecomendacaoEmpresaHistorico[]> {
  const selectCompleto = `
      id,
      created_at,
      turista_canal,
      turista_email_prefix,
      turista_whatsapp_final,
      turista_whatsapp_ddd,
      empresa_id,
      empresas:empresa_id (${EMP_JOIN_FIELDS})
    `
  const selectComDdd = `
      id,
      created_at,
      turista_whatsapp_final,
      turista_whatsapp_ddd,
      empresa_id,
      empresas:empresa_id (${EMP_JOIN_FIELDS})
    `
  const selectSoFinal = `
      id,
      created_at,
      turista_whatsapp_final,
      empresa_id,
      empresas:empresa_id (${EMP_JOIN_FIELDS})
    `
  const selectBase = `
      id,
      created_at,
      empresa_id,
      empresas:empresa_id (${EMP_JOIN_FIELDS})
    `

  const queryRec = (select: string) => {
    let q = supabase
      .from('recomendacoes')
      .select(select)
      .eq('profissional_id', profissionalId)
      .order('created_at', { ascending: false })
    if (dataLimite) q = q.gte('created_at', dataLimite)
    return q
  }

  let recData: unknown[] | null = null
  let recErr: unknown = null

  for (const select of [selectCompleto, selectComDdd, selectSoFinal, selectBase]) {
    const res = await queryRec(select)
    recData = res.data ?? null
    recErr = res.error
    if (!recErr) break
    const msg = String((recErr as { message?: string })?.message ?? '').toLowerCase()
    if (
      !isColunaInexistente(recErr) &&
      !msg.includes('turista_whatsapp') &&
      !msg.includes('turista_email') &&
      !msg.includes('turista_canal')
    ) {
      break
    }
  }

  if (recErr && !isTabelaInexistente(recErr)) throw recErr

  const agrupadas: Record<string, RecomendacaoEmpresaHistorico> = {}
  if (!recErr && recData) {
    for (const rec of recData as unknown[]) {
      const row = rec as Record<string, unknown>
      const eid = row.empresa_id != null ? String(row.empresa_id) : ''
      if (!eid) continue

      const emp = asEmpRow(row.empresas)
      const emailPrefix = normalizarEmailPrefix(row.turista_email_prefix)
      const canal = normalizarCanalRecomendacao(row.turista_canal) ?? (emailPrefix ? 'email' : 'whatsapp')

      const detalhe: RecomendacaoDetalhe = {
        id: row.id != null ? String(row.id) : `${eid}-${agrupadas[eid]?.detalhes.length ?? 0}`,
        created_at: row.created_at != null ? String(row.created_at) : new Date().toISOString(),
        turista_canal: canal,
        turista_email_prefix: emailPrefix,
        turista_whatsapp_final: normalizarWhatsappFinal(row.turista_whatsapp_final),
        turista_whatsapp_ddd: normalizarWhatsappDdd(row.turista_whatsapp_ddd),
      }

      if (!agrupadas[eid]) {
        agrupadas[eid] = {
          ...dadosCabecalhoEmpresa(emp, eid),
          total: 0,
          detalhes: [],
        }
      }
      agrupadas[eid].total += 1
      agrupadas[eid].detalhes.push(detalhe)
    }
  }

  return Object.values(agrupadas).sort((a, b) => b.total - a.total)
}

export async function resolverProfissionalIdPorUsuario(
  supabase: SupabaseClient,
  usuarioId: string,
): Promise<string | null> {
  const { data, error } = await supabase.from('profissionais').select('id').eq('usuario_id', usuarioId).maybeSingle()
  if (error || !data?.id) return null
  return String(data.id)
}
