import type { SupabaseClient } from '@supabase/supabase-js'

/** Colunas usadas pelos gates do App Shell — uma query cobre todos os consumidores. */
export const USUARIO_BOOTSTRAP_SELECT =
  'id, status, role, documentacao_validada_adm, turista_pre_liberado_ate, admin_level, admin_permissoes, email, username'

type UsuarioRow = Record<string, unknown>

type CacheEntry = { at: number; row: UsuarioRow | null }

const TTL_MS = 45_000
const rowCache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<{ data: UsuarioRow | null; error: Error | null }>>()

function parseSelect(select: string): string[] {
  return select
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function pickColumns(row: UsuarioRow, select: string): UsuarioRow {
  const out: UsuarioRow = {}
  for (const col of parseSelect(select)) {
    if (col in row) out[col] = row[col]
  }
  return out
}

function cacheCoversSelect(row: UsuarioRow | null, select: string): boolean {
  if (!row) return false
  return parseSelect(select).every((col) => col in row)
}

function bootstrapCoversSelect(select: string): boolean {
  const bootstrap = new Set(parseSelect(USUARIO_BOOTSTRAP_SELECT))
  return parseSelect(select).every((col) => bootstrap.has(col))
}

/**
 * Busca linha de `usuarios` com dedupe in-flight + TTL por usuário.
 * Selects contidos no bootstrap compartilham a mesma query física.
 */
export async function buscarUsuarioCached(
  supabase: SupabaseClient,
  userId: string,
  select: string,
): Promise<{ data: UsuarioRow | null; error: Error | null }> {
  const uid = userId?.trim()
  if (!uid) return { data: null, error: null }

  const now = Date.now()
  const cached = rowCache.get(uid)
  if (cached && now - cached.at < TTL_MS && cacheCoversSelect(cached.row, select)) {
    return { data: pickColumns(cached.row!, select), error: null }
  }

  const fetchSelect = bootstrapCoversSelect(select) ? USUARIO_BOOTSTRAP_SELECT : select
  const inflightKey = `${uid}::${fetchSelect}`

  let pending = inflight.get(inflightKey)
  if (!pending) {
    pending = (async (): Promise<{ data: UsuarioRow | null; error: Error | null }> => {
      const { data, error } = await supabase
        .from('usuarios')
        .select(fetchSelect)
        .eq('id', uid)
        .maybeSingle()
      inflight.delete(inflightKey)
      const row = data && typeof data === 'object' ? (data as UsuarioRow) : null
      if (!error) {
        const prev = rowCache.get(uid)
        const merged = prev?.row && row ? { ...prev.row, ...row } : row
        rowCache.set(uid, { at: Date.now(), row: merged })
      }
      return { data: row, error: error as Error | null }
    })()
    inflight.set(inflightKey, pending)
  }

  const { data, error } = await pending
  if (error) return { data: null, error }

  const full = rowCache.get(uid)?.row ?? data
  if (!full || !cacheCoversSelect(full, select)) {
    return { data, error: null }
  }
  return { data: pickColumns(full, select), error: null }
}

/** Limpa cache após mudança de perfil / convite admin / logout explícito. */
export function invalidarCacheUsuarioSession(userId?: string): void {
  if (!userId?.trim()) {
    rowCache.clear()
    inflight.clear()
    return
  }
  const uid = userId.trim()
  rowCache.delete(uid)
  for (const key of inflight.keys()) {
    if (key.startsWith(`${uid}::`)) inflight.delete(key)
  }
}
