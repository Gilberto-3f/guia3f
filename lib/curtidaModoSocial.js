/**
 * Curtidas no feed separadas por modo anfitrião (perfil profissional) vs hospedagem (empresa).
 * @param {import('@supabase/postgrest-js').PostgrestFilterBuilder<any, any, any>} query
 * @param {string | null | undefined} empresaInteratorId
 */
export function filtrarCurtidaPorModoAtual(query, empresaInteratorId) {
  const emp = empresaInteratorId != null ? String(empresaInteratorId).trim() : ''
  if (emp) return query.eq('empresa_interator_id', emp)
  return query.is('empresa_interator_id', null)
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{
 *   postId?: string | null
 *   comentarioId?: string | null
 *   usuarioId: string
 *   empresaInteratorId?: string | null
 * }} params
 */
export async function usuarioCurtiuNoModoAtual(supabase, { postId, comentarioId, usuarioId, empresaInteratorId }) {
  const uid = String(usuarioId ?? '').trim()
  if (!uid) return false

  let query = supabase.from('curtidas').select('id').eq('usuario_id', uid)
  if (postId) query = query.eq('post_id', String(postId).trim())
  if (comentarioId) query = query.eq('comentario_id', String(comentarioId).trim())
  query = filtrarCurtidaPorModoAtual(query, empresaInteratorId)

  const { data } = await query.maybeSingle()
  return Boolean(data)
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{
 *   postId?: string | null
 *   comentarioId?: string | null
 *   usuarioId: string
 *   empresaInteratorId?: string | null
 * }} params
 */
export async function deletarCurtidaModoAtual(supabase, { postId, comentarioId, usuarioId, empresaInteratorId }) {
  const uid = String(usuarioId ?? '').trim()
  if (!uid) return { data: [], error: null }

  let query = supabase.from('curtidas').delete().eq('usuario_id', uid)
  if (postId) query = query.eq('post_id', String(postId).trim())
  if (comentarioId) query = query.eq('comentario_id', String(comentarioId).trim())
  query = filtrarCurtidaPorModoAtual(query, empresaInteratorId)

  return query.select('id')
}

/** Chave estável para curtida de story (JSON em stories.curtidas). */
export function chaveCurtidaStory(usuarioId, empresaInteratorId) {
  const uid = String(usuarioId ?? '').trim()
  const emp = empresaInteratorId != null ? String(empresaInteratorId).trim() : ''
  return emp ? `${uid}:emp:${emp}` : `${uid}:prof`
}

/**
 * @param {unknown} raw
 * @returns {{ usuario_id: string, created_at?: string, empresa_interator_id?: string | null }[]}
 */
export function parseCurtidasStoryModo(raw) {
  if (raw == null || !Array.isArray(raw)) return []
  /** @type {{ usuario_id: string, created_at?: string, empresa_interator_id?: string | null }[]} */
  const out = []
  for (const item of raw) {
    if (item == null) continue
    if (typeof item === 'string') {
      const uid = item.trim()
      if (uid) out.push({ usuario_id: uid })
      continue
    }
    if (typeof item !== 'object') continue
    const row = /** @type {Record<string, unknown>} */ (item)
    const uid = row.usuario_id != null ? String(row.usuario_id).trim() : ''
    if (!uid) continue
    const created_at = row.created_at != null ? String(row.created_at) : undefined
    const emp =
      row.empresa_interator_id != null && String(row.empresa_interator_id).trim() !== ''
        ? String(row.empresa_interator_id).trim()
        : null
    out.push({ usuario_id: uid, created_at, empresa_interator_id: emp })
  }
  return out
}

/**
 * @param {{ usuario_id: string, empresa_interator_id?: string | null }[]} lista
 * @param {string | null | undefined} usuarioId
 * @param {string | null | undefined} empresaInteratorId
 */
export function usuarioCurtiuStoryNoModoAtual(lista, usuarioId, empresaInteratorId) {
  const alvo = chaveCurtidaStory(usuarioId, empresaInteratorId)
  return lista.some((c) => chaveCurtidaStory(c.usuario_id, c.empresa_interator_id) === alvo)
}
