/**
 * @param {unknown} error
 */
export function isDuplicateCurtidaError(error) {
  if (!error || typeof error !== 'object') return false
  const code = /** @type {{ code?: string }} */ (error).code
  return code === '23505'
}

/**
 * Toggle atômico via RPC (`toggle_curtida_social`).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{
 *   postId?: string | null
 *   comentarioId?: string | null
 *   empresaInteratorId?: string | null
 * }} params
 * @returns {Promise<{ data: { liked?: boolean; curtida_id?: string } | null; error: import('@supabase/supabase-js').PostgrestError | null }>}
 */
export async function toggleCurtidaSocial(supabase, { postId, comentarioId, empresaInteratorId }) {
  const emp =
    empresaInteratorId != null && String(empresaInteratorId).trim() !== ''
      ? String(empresaInteratorId).trim()
      : null

  const { data, error } = await supabase.rpc('toggle_curtida_social', {
    p_post_id: postId ?? null,
    p_comentario_id: comentarioId ?? null,
    p_empresa_interator_id: emp,
  })

  return { data: data ?? null, error }
}
