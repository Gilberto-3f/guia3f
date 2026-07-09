import type { SupabaseClient } from '@supabase/supabase-js'

export const JANELA_POSTS_RECENTES_MS = 2 * 60 * 60 * 1000

export type PostComCreatedAt = { id: string; created_at: string }

function ordenarPorCreatedDesc<T extends PostComCreatedAt>(lista: T[]): T[] {
  return [...lista].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
}

/**
 * Fila dinâmica do feed:
 * - Se houver não vistos: recentes (últimas 2h) → antigos não vistos → vistos (todos DESC).
 * - Se todos vistos: cronologia padrão (created_at DESC).
 */
export function ordenarPostsFeedPorVisualizacao<T extends PostComCreatedAt>(
  posts: T[],
  vistosSet: ReadonlySet<string>,
): T[] {
  if (posts.length === 0) return posts

  const todosVistos = posts.every((p) => vistosSet.has(String(p.id)))
  if (todosVistos) return ordenarPorCreatedDesc(posts)

  const cutoff = Date.now() - JANELA_POSTS_RECENTES_MS
  const naoVistosRecentes: T[] = []
  const naoVistosAntigos: T[] = []
  const vistos: T[] = []

  for (const p of posts) {
    const id = String(p.id)
    if (vistosSet.has(id)) {
      vistos.push(p)
      continue
    }
    const t = new Date(p.created_at).getTime()
    if (!Number.isNaN(t) && t >= cutoff) naoVistosRecentes.push(p)
    else naoVistosAntigos.push(p)
  }

  return [
    ...ordenarPorCreatedDesc(naoVistosRecentes),
    ...ordenarPorCreatedDesc(naoVistosAntigos),
    ...ordenarPorCreatedDesc(vistos),
  ]
}

/**
 * IDs de posts já visualizados pelo usuário (subset opcional).
 */
export async function fetchPostIdsVisualizadosFeed(
  supabase: SupabaseClient,
  usuarioId: string,
  postIds?: string[],
): Promise<Set<string>> {
  const uid = String(usuarioId ?? '').trim()
  const out = new Set<string>()
  if (!uid) return out

  let q = supabase.from('feed_visualizacao').select('post_id').eq('usuario_id', uid)

  const ids = [...new Set((postIds ?? []).map((x) => String(x).trim()).filter(Boolean))]
  if (ids.length > 0) q = q.in('post_id', ids)

  const { data, error } = await q
  if (error) {
    console.warn('[feedVisualizacao] fetchPostIdsVisualizadosFeed:', error.message)
    return out
  }

  for (const row of data ?? []) {
    const pid = row.post_id != null ? String(row.post_id) : ''
    if (pid) out.add(pid)
  }
  return out
}

/**
 * Marca post como visualizado (idempotente — mantém primeiro visto_em).
 */
export async function marcarPostVisualizadoFeed(
  supabase: SupabaseClient,
  usuarioId: string,
  postId: string,
): Promise<boolean> {
  const uid = String(usuarioId ?? '').trim()
  const pid = String(postId ?? '').trim()
  if (!uid || !pid) return false

  const { error } = await supabase.from('feed_visualizacao').upsert(
    {
      usuario_id: uid,
      post_id: pid,
      visto_em: new Date().toISOString(),
    },
    { onConflict: 'usuario_id,post_id', ignoreDuplicates: true },
  )

  if (error) {
    console.warn('[feedVisualizacao] marcarPostVisualizadoFeed:', error.message)
    return false
  }
  return true
}
