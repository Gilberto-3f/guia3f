import type { SupabaseClient } from '@supabase/supabase-js'
import {
  classificarTipoProfissionalCartao,
  normalizarCategoriasProfissional,
  type TipoProfissionalCartao,
} from '@/lib/cartaoVisitaProfissional'

function metaObj(raw: unknown): Record<string, unknown> {
  return typeof raw === 'object' && raw != null && !Array.isArray(raw)
    ? { ...(raw as Record<string, unknown>) }
    : {}
}

/** Guia, van ou taxista (mobilidade contratável). */
export function visitadoEhMobilidadeAvaliavel(
  placaVermelha: boolean,
  categorias: string[] | null | undefined,
): boolean {
  if (placaVermelha) return true
  const cats = normalizarCategoriasProfissional(categorias)
  return cats.includes('guia') || cats.includes('van') || cats.includes('taxista')
}

async function profissionalRowPorUsuario(
  supabase: SupabaseClient,
  profissionalUsuarioId: string,
): Promise<{ id: string; empresa_hospedagem_id: string | null } | null> {
  const { data, error } = await supabase
    .from('profissionais')
    .select('id, empresa_hospedagem_id')
    .eq('usuario_id', profissionalUsuarioId)
    .maybeSingle()

  if (error || !data?.id) return null
  return {
    id: String(data.id),
    empresa_hospedagem_id:
      data.empresa_hospedagem_id != null ? String(data.empresa_hospedagem_id) : null,
  }
}

/** Turista já registrou avaliação para o profissional visitado. */
export async function turistaJaAvaliouProfissional(
  supabase: SupabaseClient,
  turistaUsuarioId: string,
  profissionalId: string,
): Promise<boolean> {
  if (!turistaUsuarioId || !profissionalId) return false

  const { data, error } = await supabase
    .from('avaliacoes')
    .select('id')
    .eq('usuario_id', turistaUsuarioId)
    .eq('alvo_tipo', 'profissional')
    .eq('alvo_id', profissionalId)
    .limit(1)

  if (error) {
    const msg = String(error.message ?? '').toLowerCase()
    if (msg.includes('permission') || msg.includes('policy') || msg.includes('42501')) {
      return false
    }
    console.warn('[cartaoVisitaAvaliacaoTurista] avaliacoes:', error.message)
    return false
  }

  return (data?.length ?? 0) > 0
}

/** Mobilidade concluída e corrida ainda não avaliada pelo turista. */
export async function turistaPodeAvaliarProfissionalMobilidade(
  supabase: SupabaseClient,
  turistaUsuarioId: string,
  profissionalUsuarioId: string,
): Promise<boolean> {
  if (!turistaUsuarioId || !profissionalUsuarioId) return false
  if (turistaUsuarioId === profissionalUsuarioId) return false

  const prof = await profissionalRowPorUsuario(supabase, profissionalUsuarioId)
  if (!prof?.id) return false

  if (await turistaJaAvaliouProfissional(supabase, turistaUsuarioId, prof.id)) {
    return false
  }

  const { data: rows, error } = await supabase
    .from('solicitacao_mobilidade')
    .select('id, status, metadata')
    .eq('turista_id', turistaUsuarioId)
    .eq('profissional_id', prof.id)
    .eq('status', 'concluida')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    const msg = String(error.message ?? '').toLowerCase()
    if (msg.includes('permission') || msg.includes('policy') || msg.includes('42501')) {
      return false
    }
    console.warn('[cartaoVisitaAvaliacaoTurista] solicitacao_mobilidade:', error.message)
    return false
  }

  return (rows ?? []).some((r) => !metaObj(r.metadata).avaliacao_turista_id)
}

async function empresaIdsAnfitriaoProfissional(
  supabase: SupabaseClient,
  profissionalUsuarioId: string,
  prof: { empresa_hospedagem_id: string | null },
): Promise<string[]> {
  const ids = new Set<string>()
  if (prof.empresa_hospedagem_id) ids.add(prof.empresa_hospedagem_id)

  const { data: emps } = await supabase
    .from('empresas')
    .select('id')
    .eq('usuario_id', profissionalUsuarioId)
    .eq('somente_anfitriao', true)

  for (const e of emps ?? []) {
    if (e?.id) ids.add(String(e.id))
  }

  return [...ids]
}

/** Reserva confirmada com check-out no passado ou hoje (hóspede já saiu). */
export async function turistaPodeAvaliarAnfitriaoPosCheckout(
  supabase: SupabaseClient,
  turistaUsuarioId: string,
  profissionalUsuarioId: string,
): Promise<boolean> {
  if (!turistaUsuarioId || !profissionalUsuarioId) return false
  if (turistaUsuarioId === profissionalUsuarioId) return false

  const prof = await profissionalRowPorUsuario(supabase, profissionalUsuarioId)
  if (!prof?.id) return false

  if (await turistaJaAvaliouProfissional(supabase, turistaUsuarioId, prof.id)) {
    return false
  }

  const empresaIds = await empresaIdsAnfitriaoProfissional(supabase, profissionalUsuarioId, prof)
  if (empresaIds.length === 0) return false

  const hoje = new Date().toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('reservas_hospedagem')
    .select('id')
    .in('empresa_id', empresaIds)
    .eq('turista_usuario_id', turistaUsuarioId)
    .eq('status', 'confirmada')
    .lte('data_checkout', hoje)
    .limit(1)

  if (error) {
    const msg = String(error.message ?? '').toLowerCase()
    if (msg.includes('permission') || msg.includes('policy') || msg.includes('42501')) {
      return false
    }
    console.warn('[cartaoVisitaAvaliacaoTurista] reservas_hospedagem:', error.message)
    return false
  }

  return (data?.length ?? 0) > 0
}

/**
 * Motorista de app: avaliação sempre disponível (personal shopper), exceto se já avaliou.
 */
export async function turistaPodeAvaliarMotoristaApp(
  supabase: SupabaseClient,
  turistaUsuarioId: string,
  profissionalUsuarioId: string,
): Promise<boolean> {
  if (!turistaUsuarioId || !profissionalUsuarioId) return false
  if (turistaUsuarioId === profissionalUsuarioId) return false

  const prof = await profissionalRowPorUsuario(supabase, profissionalUsuarioId)
  if (!prof?.id) return false

  return !(await turistaJaAvaliouProfissional(supabase, turistaUsuarioId, prof.id))
}

/**
 * Resolve se o turista/empresa pode ver o botão Avaliar no cartão de visita.
 * Só motorista de app: personal shopper. Mobilidade e anfitrião avaliam no
 * fluxo de conclusão / check-out, não no cartão.
 */
export async function turistaPodeAvaliarProfissionalCartao(
  supabase: SupabaseClient,
  turistaUsuarioId: string,
  profissionalUsuarioId: string,
  visitadoPlacaVermelha: boolean,
  visitadoCategorias: string[] | null | undefined,
): Promise<boolean> {
  const visitadoTipo = classificarTipoProfissionalCartao(
    visitadoPlacaVermelha,
    visitadoCategorias,
  )

  if (visitadoTipo === 'motorista_app') {
    return turistaPodeAvaliarMotoristaApp(supabase, turistaUsuarioId, profissionalUsuarioId)
  }

  return false
}

export function tipoProfissionalCartaoPermiteAvaliarTurista(
  visitadoTipo: TipoProfissionalCartao,
  _visitadoPlacaVermelha: boolean,
  _visitadoCategorias: string[] | null | undefined,
): boolean {
  return visitadoTipo === 'motorista_app'
}
