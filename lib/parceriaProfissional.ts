import type { SupabaseClient } from '@supabase/supabase-js'

async function idsProfissionaisPorUsuario(
  supabase: SupabaseClient,
  usuarioIdA: string,
  usuarioIdB: string,
): Promise<{ profAId: string | null; profBId: string | null }> {
  const [{ data: profA }, { data: profB }] = await Promise.all([
    supabase.from('profissionais').select('id').eq('usuario_id', usuarioIdA).maybeSingle(),
    supabase.from('profissionais').select('id').eq('usuario_id', usuarioIdB).maybeSingle(),
  ])

  return {
    profAId: profA?.id != null ? String(profA.id) : null,
    profBId: profB?.id != null ? String(profB.id) : null,
  }
}

/** Par de IDs canônico (menor primeiro) para consulta única. */
function parOrdenado(id1: string, id2: string): [string, string] {
  return id1 < id2 ? [id1, id2] : [id2, id1]
}

async function parceriaNaTabela(
  supabase: SupabaseClient,
  profAId: string,
  profBId: string,
): Promise<boolean> {
  const [a, b] = parOrdenado(profAId, profBId)
  const { data, error } = await supabase
    .from('parcerias_profissionais')
    .select('id')
    .eq('profissional_a_id', a)
    .eq('profissional_b_id', b)
    .in('status', ['fechada', 'em_andamento', 'concluida'])
    .maybeSingle()

  if (error) {
    const msg = String(error.message ?? '').toLowerCase()
    if (msg.includes('parcerias_profissionais') && msg.includes('does not exist')) return false
    console.warn('[parceriaProfissional] consulta tabela:', error.message)
    return false
  }

  return Boolean(data?.id)
}

/** Fallback: parceria gerada na janela de pré-liberação (extrato_parceria). */
async function parceriaViaCanalFinanceiro(
  supabase: SupabaseClient,
  usuarioIdA: string,
  usuarioIdB: string,
  profAId: string,
  profBId: string,
): Promise<boolean> {
  const { data: rows, error } = await supabase
    .from('canal_financeiro')
    .select('comprovante_detalhes, profissional_id')
    .eq('tipo', 'extrato_parceria')
    .in('profissional_id', [profAId, profBId])
    .limit(20)

  if (error) {
    console.warn('[parceriaProfissional] canal_financeiro:', error.message)
    return false
  }

  for (const row of rows ?? []) {
    const meta =
      row.comprovante_detalhes && typeof row.comprovante_detalhes === 'object'
        ? (row.comprovante_detalhes as Record<string, unknown>)
        : {}
    const prospector = String(meta.prof_prospector_usuario_id ?? '').trim()
    const contratado = String(meta.profissional_contratado_usuario_id ?? '').trim()
    if (!prospector || !contratado) continue

    const par = new Set([prospector, contratado])
    if (par.has(usuarioIdA) && par.has(usuarioIdB)) return true
  }

  return false
}

/**
 * Verifica se dois profissionais (por usuario_id) fecharam parceria.
 * Usa tabela `parcerias_profissionais` quando disponível; fallback em extrato_parceria.
 */
export async function temParceriaFechadaEntreProfissionais(
  supabase: SupabaseClient,
  usuarioIdA: string,
  usuarioIdB: string,
): Promise<boolean> {
  if (!usuarioIdA || !usuarioIdB || usuarioIdA === usuarioIdB) return false

  const { profAId, profBId } = await idsProfissionaisPorUsuario(supabase, usuarioIdA, usuarioIdB)
  if (!profAId || !profBId) return false

  if (await parceriaNaTabela(supabase, profAId, profBId)) return true
  return parceriaViaCanalFinanceiro(supabase, usuarioIdA, usuarioIdB, profAId, profBId)
}
