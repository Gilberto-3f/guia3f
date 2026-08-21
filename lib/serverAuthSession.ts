import type { SupabaseClient, User } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

type JwtPayload = {
  sub?: string
  email?: string
  phone?: string
  role?: string
  aud?: string | string[]
  exp?: number
  iat?: number
  app_metadata?: Record<string, unknown>
  user_metadata?: Record<string, unknown>
}

function decodeJwtPayload(accessToken: string): JwtPayload | null {
  const parts = accessToken.split('.')
  if (parts.length < 2) return null
  try {
    const segment = parts[1]
    const pad = segment.length % 4 === 0 ? '' : '='.repeat(4 - (segment.length % 4))
    const json = atob(segment.replace(/-/g, '+').replace(/_/g, '/') + pad)
    return JSON.parse(json) as JwtPayload
  } catch {
    return null
  }
}

function juntarCookieAuth(all: { name: string; value: string }[]): string | null {
  const grouped = new Map<string, { idx: number; value: string }[]>()
  for (const c of all) {
    const m = c.name.match(/^(sb-[a-z0-9]+-auth-token)(?:\.(\d+))?$/)
    if (!m) continue
    const base = m[1]
    const idx = m[2] != null ? Number(m[2]) : 0
    const arr = grouped.get(base) ?? []
    arr.push({ idx, value: c.value })
    grouped.set(base, arr)
  }
  if (grouped.size === 0) return null
  const chunks = [...grouped.values()][0]
  chunks.sort((a, b) => a.idx - b.idx)
  const joined = chunks.map((c) => c.value).join('')
  return joined || null
}

function extrairAccessToken(raw: string): string {
  if (raw.startsWith('{')) {
    try {
      const o = JSON.parse(raw) as { access_token?: string }
      return String(o.access_token ?? '')
    } catch {
      return ''
    }
  }
  if (raw.startsWith('base64-')) {
    try {
      const decoded = atob(raw.slice(7))
      const o = JSON.parse(decoded) as { access_token?: string }
      return String(o.access_token ?? '')
    } catch {
      return ''
    }
  }
  if (raw.split('.').length === 3) return raw
  return ''
}

/** Monta User do JWT — sem GET /auth/v1/user. */
export function userFromAccessToken(accessToken: string): User | null {
  const payload = decodeJwtPayload(accessToken)
  const id = payload?.sub
  if (!id) return null
  const aud = Array.isArray(payload.aud) ? payload.aud[0] : payload.aud
  return {
    id,
    aud: aud || 'authenticated',
    role: payload.role || 'authenticated',
    email: payload.email ?? undefined,
    phone: payload.phone ?? undefined,
    app_metadata: payload.app_metadata ?? {},
    user_metadata: payload.user_metadata ?? {},
    identities: [],
    created_at: '',
    updated_at: '',
    is_anonymous: false,
  } as User
}

export function jwtAindaValido(accessToken: string, margemSec = 60): boolean {
  const payload = decodeJwtPayload(accessToken)
  const exp = Number(payload?.exp)
  return Number.isFinite(exp) && exp * 1000 > Date.now() + margemSec * 1000
}

/**
 * Lê o usuário da sessão em cookie (sem GET /auth/v1/user e sem POST /token).
 * Preferir em rotas API e Server Components para não saturar Auth/Postgres.
 */
export async function getUserFromCookieSession(
  _supabase?: SupabaseClient,
): Promise<{ user: User | null; error: Error | null }> {
  try {
    const store = await cookies()
    const raw = juntarCookieAuth(store.getAll())
    if (!raw) return { user: null, error: null }
    const access = extrairAccessToken(raw)
    if (!access) return { user: null, error: null }
    const user = userFromAccessToken(access)
    return { user, error: user ? null : new Error('invalid_jwt') }
  } catch (err) {
    return { user: null, error: err instanceof Error ? err : new Error('cookie_session') }
  }
}
