import type { SupabaseClient } from '@supabase/supabase-js'

const STATUS_CONTRATACAO_VALIDOS = new Set(['aceita', 'concluida', 'concluido', 'finalizada', 'finalizado'])

/**
 * Verifica se o turista contratou o profissional visitado (placa vermelha / regular).
 * Consulta solicitações de mobilidade concluídas ou aceitas vinculadas ao par.
 */
export async function turistaContratouProfissional(
  supabase: SupabaseClient,
  turistaUsuarioId: string,
  profissionalUsuarioId: string,
): Promise<boolean> {
  if (!turistaUsuarioId || !profissionalUsuarioId) return false
  if (turistaUsuarioId === profissionalUsuarioId) return false

  const { data: prof, error: profErr } = await supabase
    .from('profissionais')
    .select('id')
    .eq('usuario_id', profissionalUsuarioId)
    .maybeSingle()

  if (profErr || !prof?.id) return false

  const profissionalId = String(prof.id)

  const { data: rows, error } = await supabase
    .from('solicitacao_mobilidade')
    .select('id, status')
    .eq('turista_id', turistaUsuarioId)
    .eq('profissional_id', profissionalId)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    const msg = String(error.message ?? '').toLowerCase()
    if (msg.includes('permission') || msg.includes('policy') || msg.includes('42501')) {
      return false
    }
    console.warn('[contratacaoProfissionalTurista] solicitacao_mobilidade:', error.message)
    return false
  }

  return (rows ?? []).some((r) => STATUS_CONTRATACAO_VALIDOS.has(String(r.status ?? '').toLowerCase()))
}
