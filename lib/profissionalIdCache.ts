import type { SupabaseClient } from '@supabase/supabase-js'

const TTL_MS = 60_000
const cache = new Map<string, { id: string; at: number }>()

/** Evita SELECT profissionais.id em todo poll (dois aparelhos saturavam o REST). */
export async function profissionalIdPorUsuario(
  admin: SupabaseClient,
  usuarioId: string,
): Promise<string | null> {
  const uid = String(usuarioId ?? '').trim()
  if (!uid) return null
  const hit = cache.get(uid)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.id
  const { data } = await admin.from('profissionais').select('id').eq('usuario_id', uid).maybeSingle()
  const id = data?.id != null ? String(data.id) : ''
  if (!id) return null
  cache.set(uid, { id, at: Date.now() })
  return id
}
