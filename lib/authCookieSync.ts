import { supabase } from '@/lib/supabase'

const DEDUPE_OK_MS = 8_000

/** @type {Promise<boolean> | null} */
let inflightSync: Promise<boolean> | null = null
/** @type {string | null} */
let inflightKey: string | null = null
/** @type {string | null} */
let lastOkKey: string | null = null
let lastOkAt = 0

function tokenFingerprint(session: { access_token: string; refresh_token: string }): string {
  const a = session.access_token
  const r = session.refresh_token
  return `${a.length}:${a.slice(0, 24)}:${a.slice(-12)}:${r.length}:${r.slice(0, 16)}`
}

/**
 * Alinha cookies HttpOnly (middleware / SSR) com a sessão do cliente Supabase (localStorage).
 * Deduplica POST simultâneos (login + SupabaseCookieSync) para não martelar Auth `/token`.
 */
export async function syncSessionCookiesToServer(session: {
  access_token: string
  refresh_token: string
}): Promise<boolean> {
  if (!session.access_token || !session.refresh_token) return false

  const key = tokenFingerprint(session)
  const now = Date.now()
  if (lastOkKey === key && now - lastOkAt < DEDUPE_OK_MS) return true

  if (inflightSync && inflightKey === key) return inflightSync

  if (inflightSync) {
    try {
      await inflightSync
    } catch {
      /* segue */
    }
    if (lastOkKey === key && Date.now() - lastOkAt < DEDUPE_OK_MS) return true
  }

  inflightKey = key
  inflightSync = (async () => {
    try {
      const res = await fetch('/api/auth/sync-cookies', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        }),
      })
      const ok = res.ok
      if (ok) {
        lastOkKey = key
        lastOkAt = Date.now()
      }
      return ok
    } finally {
      inflightSync = null
      inflightKey = null
    }
  })()

  return inflightSync
}

/** Remove cookies de sessão no servidor (após signOut no cliente). */
export async function clearSessionCookiesOnServer(): Promise<boolean> {
  lastOkKey = null
  lastOkAt = 0
  const res = await fetch('/api/auth/sync-cookies', {
    method: 'DELETE',
    credentials: 'same-origin',
  })
  return res.ok
}

/**
 * Encerra só a sessão deste aparelho/navegador.
 * O padrão do Supabase (`signOut()` sem scope) é `global` e desloga todos os dispositivos.
 */
export async function signOutCurrentDevice(): Promise<void> {
  await supabase.auth.signOut({ scope: 'local' })
  try {
    await clearSessionCookiesOnServer()
  } catch {
    /* ignore */
  }
}
