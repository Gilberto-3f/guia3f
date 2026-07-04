/**
 * Garante remoção em `atividades` após descurtir (fallback se o trigger AFTER DELETE falhar).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{
 *   postId?: string | null
 *   comentarioId?: string | null
 *   usuarioId: string
 *   empresaInteratorId?: string | null
 *   curtidaId?: string | null
 * }} params
 */
export async function limparAtividadesAposDescurtir(
  supabase,
  { postId, comentarioId, usuarioId, empresaInteratorId, curtidaId },
) {
  const uid = usuarioId != null ? String(usuarioId).trim() : ''
  if (!uid) return
  const pid = postId != null ? String(postId).trim() : ''
  const cid = comentarioId != null ? String(comentarioId).trim() : ''
  if (!pid && !cid) return

  const emp = empresaInteratorId != null ? String(empresaInteratorId).trim() : ''
  const curtId = curtidaId != null ? String(curtidaId).trim() : ''

  const { error } = await supabase.rpc('limpar_atividades_apos_descurtir', {
    p_post_id: pid || null,
    p_comentario_id: cid || null,
    p_usuario_id: uid,
    p_curtida_id: curtId || null,
    p_empresa_interator_id: emp || null,
  })
  if (error && process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.warn('[limparAtividadesAposDescurtir] RPC:', error.message)
  }
}
