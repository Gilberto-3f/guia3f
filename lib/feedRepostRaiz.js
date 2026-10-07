/**
 * Árvore de republicações no feed (raiz + satélites, inclusive cadeia antiga R1→R2).
 * @param {Array<{ id?: unknown, post_original_id?: unknown }>} posts
 * @param {string} postId
 * @returns {Set<string>}
 */
export function idsNaArvoreRepost(posts, postId) {
  const raiz = String(postId ?? '').trim()
  if (!raiz) return new Set()
  const gone = new Set([raiz])
  let changed = true
  while (changed) {
    changed = false
    for (const p of posts) {
      const id = p?.id != null ? String(p.id) : ''
      if (!id || gone.has(id)) continue
      const parent =
        p.post_original_id != null && String(p.post_original_id).trim() !== ''
          ? String(p.post_original_id)
          : ''
      if (parent && gone.has(parent)) {
        gone.add(id)
        changed = true
      }
    }
  }
  return gone
}

/**
 * @template {{ id?: unknown, post_original_id?: unknown }} T
 * @param {T[]} posts
 * @param {string} postId
 * @returns {T[]}
 */
export function filtrarPostsForaDaArvore(posts, postId) {
  const gone = idsNaArvoreRepost(posts, postId)
  return posts.filter((p) => !gone.has(p?.id != null ? String(p.id) : ''))
}

/**
 * @template {{ id?: unknown, post_original_id?: unknown, texto?: unknown }} T
 * @param {T[]} posts
 * @param {string} postId
 * @param {string | null} texto
 * @returns {T[]}
 */
export function patchTextoNaArvore(posts, postId, texto) {
  const ids = idsNaArvoreRepost(posts, postId)
  return posts.map((p) => (ids.has(p?.id != null ? String(p.id) : '') ? { ...p, texto } : p))
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} postId
 * @returns {Promise<string>}
 */
export async function resolverPostRaizId(supabase, postId) {
  const start = String(postId ?? '').trim()
  if (!start) return start
  const { data, error } = await supabase.rpc('resolver_post_raiz', { p_post_id: start })
  if (!error && data != null && String(data).trim() !== '') {
    return String(data)
  }
  let cur = start
  for (let i = 0; i < 20; i++) {
    const { data: row } = await supabase
      .from('posts')
      .select('id, post_original_id')
      .eq('id', cur)
      .maybeSingle()
    const parent =
      row?.post_original_id != null && String(row.post_original_id).trim() !== ''
        ? String(row.post_original_id)
        : ''
    if (!parent) return row?.id != null ? String(row.id) : cur
    if (parent === cur) return cur
    cur = parent
  }
  return cur
}
