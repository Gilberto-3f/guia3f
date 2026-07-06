import type { SupabaseClient } from '@supabase/supabase-js'

const TTL_MS = 30_000
const cache = new Map<string, { at: number; ids: string[] }>()
const inflight = new Map<string, Promise<string[]>>()

/** Lista `seguido_id` do seguidor com dedupe in-flight + TTL curto. */
export async function listarSeguidosIdsCached(
  supabase: SupabaseClient,
  seguidorId: string,
): Promise<string[]> {
  const uid = seguidorId?.trim()
  if (!uid) return []

  const now = Date.now()
  const hit = cache.get(uid)
  if (hit && now - hit.at < TTL_MS) return hit.ids

  let pending = inflight.get(uid)
  if (!pending) {
    pending = (async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('redecontatos')
        .select('seguido_id')
        .eq('seguidor_id', uid)
      inflight.delete(uid)
      if (error) return hit?.ids ?? []
      const ids = (data ?? [])
        .map((r) => String((r as { seguido_id: unknown }).seguido_id))
        .filter(Boolean)
      cache.set(uid, { at: Date.now(), ids })
      return ids
    })()
    inflight.set(uid, pending)
  }

  return pending
}

export function invalidarCacheSeguidos(seguidorId?: string): void {
  if (!seguidorId?.trim()) {
    cache.clear()
    inflight.clear()
    return
  }
  const uid = seguidorId.trim()
  cache.delete(uid)
  inflight.delete(uid)
}
