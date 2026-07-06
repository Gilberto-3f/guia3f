import type { NextRequest } from 'next/server'

const BUFFER_SEC = 30

function decodeJwtPayload(accessToken: string): { exp?: number } | null {
  const parts = accessToken.split('.')
  if (parts.length < 2) return null
  try {
    const segment = parts[1]
    const pad = segment.length % 4 === 0 ? '' : '='.repeat(4 - (segment.length % 4))
    const b64 = segment.replace(/-/g, '+').replace(/_/g, '/') + pad
    const json = atob(b64)
    return JSON.parse(json) as { exp?: number }
  } catch {
    return null
  }
}

/** Reúne cookies `sb-*-auth-token` (incl. chunks `.0`, `.1`). */
export function lerCookieSessaoSupabase(request: NextRequest): string | null {
  const grouped = new Map<string, { idx: number; value: string }[]>()

  for (const c of request.cookies.getAll()) {
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

function extrairTokens(raw: string): { accessToken: string; refreshToken: string } {
  if (raw.startsWith('{')) {
    try {
      const o = JSON.parse(raw) as { access_token?: string; refresh_token?: string }
      return {
        accessToken: String(o.access_token ?? ''),
        refreshToken: String(o.refresh_token ?? ''),
      }
    } catch {
      return { accessToken: '', refreshToken: '' }
    }
  }

  if (raw.startsWith('base64-')) {
    try {
      const decoded = atob(raw.slice(7))
      const o = JSON.parse(decoded) as { access_token?: string; refresh_token?: string }
      return {
        accessToken: String(o.access_token ?? ''),
        refreshToken: String(o.refresh_token ?? ''),
      }
    } catch {
      return { accessToken: '', refreshToken: '' }
    }
  }

  return { accessToken: '', refreshToken: '' }
}

/**
 * Verifica sessão só pelos cookies — sem GET /auth/v1/user no Edge (evita 504 em rajada).
 * Aceita refresh_token válido (cliente renova depois) ou access_token ainda dentro do prazo.
 */
export function middlewareTemSessaoLocal(request: NextRequest): boolean {
  const raw = lerCookieSessaoSupabase(request)
  if (!raw) return false

  const { accessToken, refreshToken } = extrairTokens(raw)

  if (refreshToken.length > 16) return true

  if (!accessToken.includes('.')) {
    return raw.length > 32
  }

  const payload = decodeJwtPayload(accessToken)
  const exp = payload?.exp
  if (typeof exp === 'number') {
    return exp > Math.floor(Date.now() / 1000) - BUFFER_SEC
  }

  return accessToken.length > 20
}
