import type { SupabaseClient } from '@supabase/supabase-js'
import { formatProfissionalCategorias } from '@/app/[locale]/(admin)/dashboard/admin/components/verificacao/verificacaoFormatters'
import type { PeriodoRecomendacoesProf } from '@/lib/recomendacoesProfissionalHistorico'
import { getDataLimiteRecomendacoesProf } from '@/lib/recomendacoesProfissionalHistorico'
import {
  formatarEmailTuristaMascarado,
  formatarWhatsappTuristaMascarado,
} from '@/lib/recomendarEmpresa'
import { joinSupabaseRow } from '@/lib/supabaseJoinRow'

export type RecomendacaoProfParceriaDetalhe = {
  id: string
  created_at: string
  contratado_em: string | null
  origem_indicacao: 'cartao_visita' | 'ecossistema'
  turista_canal: 'whatsapp' | 'email' | null
  turista_email_prefix: string | null
  turista_whatsapp_ddd: string | null
  turista_whatsapp_final: string | null
}

export type RecomendacaoProfissionalHistorico = {
  profissional_id: string
  profissional_nome: string
  profissional_username: string
  profissional_foto_url: string | null
  profissional_categorias: string
  total: number
  contratacoes: number
  detalhes: RecomendacaoProfParceriaDetalhe[]
}

/**
 * Conta no histórico "Recomendações feitas":
 * - cartão de visita (ou legado sem origem): sempre
 * - drawer Ecossistema: só se ainda não houve contratação do indicado
 */
function recomendacaoContaNoHistoricoFeitas(row: {
  origem_indicacao?: string | null
  contratado_em?: string | null
}): boolean {
  const origem = String(row.origem_indicacao ?? 'cartao_visita').trim()
  if (origem === 'ecossistema') return row.contratado_em == null
  return true
}

/** Histórico de recomendações profissional → profissional (aba Parcerias). */
export async function buscarRecomendacoesProfissionaisParaProfissional(
  supabase: SupabaseClient,
  profissionalIndicadorId: string,
  periodo: PeriodoRecomendacoesProf,
): Promise<RecomendacaoProfissionalHistorico[]> {
  const dataLimite = getDataLimiteRecomendacoesProf(periodo)

  let q = supabase
    .from('recomendacoes_profissional')
    .select(
      `
      id,
      created_at,
      contratado_em,
      origem_indicacao,
      turista_canal,
      turista_email_prefix,
      turista_whatsapp_ddd,
      turista_whatsapp_final,
      profissional_indicado_id,
      profissional_indicado:profissional_indicado_id (
        id,
        nome_completo,
        nome_usuario,
        foto_perfil_url,
        foto_url,
        categorias
      )
    `,
    )
    .eq('profissional_indicador_id', profissionalIndicadorId)
    .order('created_at', { ascending: false })

  if (dataLimite) q = q.gte('created_at', dataLimite)

  let { data, error } = await q

  // Migration ainda não aplicada: segue sem filtrar por origem.
  if (error && String(error.message ?? '').toLowerCase().includes('origem_indicacao')) {
    let qLegado = supabase
      .from('recomendacoes_profissional')
      .select(
        `
      id,
      created_at,
      contratado_em,
      turista_canal,
      turista_email_prefix,
      turista_whatsapp_ddd,
      turista_whatsapp_final,
      profissional_indicado_id,
      profissional_indicado:profissional_indicado_id (
        id,
        nome_completo,
        nome_usuario,
        foto_perfil_url,
        foto_url,
        categorias
      )
    `,
      )
      .eq('profissional_indicador_id', profissionalIndicadorId)
      .order('created_at', { ascending: false })
    if (dataLimite) qLegado = qLegado.gte('created_at', dataLimite)
    const legado = await qLegado
    data = legado.data
    error = legado.error
  }

  if (error) throw error

  const agrupadas = new Map<string, RecomendacaoProfissionalHistorico>()

  for (const row of data ?? []) {
    if (!recomendacaoContaNoHistoricoFeitas(row)) continue

    const pid = row.profissional_indicado_id != null ? String(row.profissional_indicado_id) : ''
    if (!pid) continue

    const prof = joinSupabaseRow(row.profissional_indicado)
    const foto =
      prof?.foto_perfil_url != null
        ? String(prof.foto_perfil_url)
        : prof?.foto_url != null
          ? String(prof.foto_url)
          : null

    const origemRaw = String(row.origem_indicacao ?? 'cartao_visita').trim()
    const detalhe: RecomendacaoProfParceriaDetalhe = {
      id: String(row.id),
      created_at: String(row.created_at),
      contratado_em: row.contratado_em != null ? String(row.contratado_em) : null,
      origem_indicacao: origemRaw === 'ecossistema' ? 'ecossistema' : 'cartao_visita',
      turista_canal:
        row.turista_canal === 'email' ? 'email' : row.turista_canal === 'whatsapp' ? 'whatsapp' : null,
      turista_email_prefix: row.turista_email_prefix != null ? String(row.turista_email_prefix) : null,
      turista_whatsapp_ddd: row.turista_whatsapp_ddd != null ? String(row.turista_whatsapp_ddd) : null,
      turista_whatsapp_final: row.turista_whatsapp_final != null ? String(row.turista_whatsapp_final) : null,
    }

    if (!agrupadas.has(pid)) {
      agrupadas.set(pid, {
        profissional_id: pid,
        profissional_nome: String(prof?.nome_completo ?? 'Profissional'),
        profissional_username: String(prof?.nome_usuario ?? '').replace(/^@+/, ''),
        profissional_foto_url: foto,
        profissional_categorias: formatProfissionalCategorias(
          Array.isArray(prof?.categorias) ? prof.categorias.map(String) : [],
        ),
        total: 0,
        contratacoes: 0,
        detalhes: [],
      })
    }

    const item = agrupadas.get(pid)!
    item.total += 1
    if (detalhe.contratado_em) item.contratacoes += 1
    item.detalhes.push(detalhe)
  }

  return [...agrupadas.values()].sort((a, b) => b.total - a.total)
}

export function contatoMascaradoRecomendacao(d: RecomendacaoProfParceriaDetalhe): string | null {
  if (d.turista_canal === 'email' || d.turista_email_prefix) {
    return formatarEmailTuristaMascarado(d.turista_email_prefix)
  }
  return formatarWhatsappTuristaMascarado(d.turista_whatsapp_ddd, d.turista_whatsapp_final)
}
