/**
 * Serializa POST /auth/v1/token (refresh) e evita 409/504 em cascata.
 * O GoTrue trata 409 como erro fatal e chama _removeSession — aqui recuperamos
 * a sessão do storage ou reescrevemos 409 como 504 (retryable, sem logout).
 */

const MIN_GAP_MS = 1600
const LOCK_NAME = 'guia3f-auth-token-refresh'
const RECOVER_WAIT_MS = 450

/** @type {Promise<{ status: number, statusText: string, headers: [string, string][], bytes: Uint8Array }> | null} */
let inflight = null
let lastEndedAt = 0

/**
 * @param {string} url
 * @param {string} method
 */
function isTokenRefresh(url, method) {
  const u = String(url || '')
  const m = String(method || 'GET').toUpperCase()
  return m === 'POST' && u.includes('/token') && u.includes('grant_type=refresh_token')
}

/**
 * @param {string} url
 * @param {string} method
 */
function isAuthGetUser(url, method) {
  const u = String(url || '')
  const m = String(method || 'GET').toUpperCase()
  return m === 'GET' && /\/auth\/v1\/user(?:\?|$)/i.test(u)
}

/**
 * @param {{ access_token: string, refresh_token: string, expires_at?: number, token_type?: string, user?: unknown }} session
 */
function sessionToTokenPayload(session) {
  const nowSec = Math.floor(Date.now() / 1000)
  const expiresAt =
    typeof session.expires_at === 'number' && Number.isFinite(session.expires_at)
      ? session.expires_at
      : nowSec + 3600
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    token_type: session.token_type || 'bearer',
    expires_in: Math.max(1, expiresAt - nowSec),
    expires_at: expiresAt,
    user: session.user ?? null,
  }
}

/**
 * @param {unknown} session
 */
function respostaTokenOk(session) {
  if (!session || typeof session !== 'object') return null
  const s = /** @type {{ access_token?: string, refresh_token?: string }} */ (session)
  if (!s.access_token || !s.refresh_token) return null
  const body = JSON.stringify(sessionToTokenPayload(/** @type {any} */ (session)))
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function resposta504Busy() {
  return new Response(JSON.stringify({ message: 'token_refresh_busy', error: 'temporarily_unavailable' }), {
    status: 504,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * @param {number} status
 * @param {string} text
 */
function ehConflitoRefresh(status, text) {
  if (status === 409) return true
  return (
    status === 400 &&
    /already.?used|too many concurrent token refresh/i.test(text)
  )
}

/**
 * @param {{ recoverSession: () => unknown }} opts
 * @returns {typeof fetch}
 */
export function criarFetchAuthSerializado(opts) {
  const orig = fetch.bind(globalThis)

  return async (input, init) => {
    const url = typeof input === 'string' ? input : String(input?.url ?? '')
    const method = String(init?.method || (typeof input !== 'string' ? input?.method : 'GET') || 'GET')

    if (isAuthGetUser(url, method)) {
      const session = opts.recoverSession?.()
      const user =
        session && typeof session === 'object' && 'user' in session
          ? /** @type {{ user?: unknown }} */ (session).user
          : null
      if (user) {
        return new Response(JSON.stringify(user), {
          status: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        })
      }
      return new Response(JSON.stringify({ message: 'No session' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      })
    }

    if (!isTokenRefresh(url, method)) {
      return orig(input, init)
    }

    const executarPost = async () => {
      const espera = MIN_GAP_MS - (Date.now() - lastEndedAt)
      if (espera > 0) await new Promise((r) => setTimeout(r, espera))

      const doPost = () => orig(input, init)
      /** @type {Response} */
      let res
      if (typeof navigator !== 'undefined' && navigator.locks?.request) {
        try {
          res = await navigator.locks.request(LOCK_NAME, { mode: 'exclusive' }, doPost)
        } catch {
          res = await doPost()
        }
      } else {
        res = await doPost()
      }

      if (res.ok) return res

      if (res.status === 502 || res.status === 503 || res.status === 504) {
        const recoveredBusy = respostaTokenOk(opts.recoverSession?.())
        if (recoveredBusy) {
          console.warn('[auth] POST /token', res.status, '— sessão local ainda válida')
          return recoveredBusy
        }
      }

      const clone = res.clone()
      const text = await clone.text().catch(() => '')
      if (!ehConflitoRefresh(res.status, text)) return res

      await new Promise((r) => setTimeout(r, RECOVER_WAIT_MS))
      const recovered = respostaTokenOk(opts.recoverSession?.())
      if (recovered) {
        console.warn('[auth] POST /token conflito — usando sessão já renovada no storage')
        return recovered
      }
      if (res.status === 409) {
        console.warn('[auth] POST /token 409 — adia em vez de encerrar a sessão')
        return resposta504Busy()
      }
      return res
    }

    const start = () =>
      (async () => {
        try {
          const res = await executarPost()
          const buf = new Uint8Array(await res.arrayBuffer())
          return {
            status: res.status,
            statusText: res.statusText,
            headers: /** @type {[string, string][]} */ ([...res.headers.entries()]),
            bytes: buf,
          }
        } finally {
          lastEndedAt = Date.now()
          inflight = null
        }
      })()

    if (!inflight) inflight = start()
    const snap = await inflight
    return new Response(snap.bytes.slice(), {
      status: snap.status,
      statusText: snap.statusText,
      headers: snap.headers,
    })
  }
}
