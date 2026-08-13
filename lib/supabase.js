import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '@supabase: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY (veja o dashboard do projeto)'
  )
}

const CACHE_MS = 20_000
const GET_USER_TIMEOUT_MS = 8_000
const GET_SESSION_TIMEOUT_MS = 8_000

/**
 * @param {unknown} err
 */
function isAuthTimeoutError(err) {
  if (!err || typeof err !== 'object') return false
  const msg = String(/** @type {{ message?: string }} */ (err).message ?? err)
  const status = /** @type {{ status?: number }} */ (err).status
  return (
    status === 504 ||
    /deadline exceeded|request timeout|timed out|504|fetch failed|network/i.test(msg)
  )
}

/**
 * @param {unknown} err
 */
function isRefreshTokenAlreadyUsed(err) {
  if (!err || typeof err !== 'object') return false
  const msg = String(/** @type {{ message?: string; code?: string }} */ (err).message ?? err)
  const code = String(/** @type {{ code?: string }} */ (err).code ?? '')
  return (
    /refresh.?token.?already.?used|Already Used/i.test(msg) ||
    code === 'refresh_token_already_used'
  )
}

/** Refresh definitivamente inválido — limpar sessão evita 401 em cascata no REST. */
function isRefreshTokenInvalid(err) {
  if (!err || typeof err !== 'object') return false
  const msg = String(/** @type {{ message?: string; code?: string }} */ (err).message ?? err)
  const code = String(/** @type {{ code?: string }} */ (err).code ?? '')
  const status = /** @type {{ status?: number }} */ (err).status
  if (isRefreshTokenAlreadyUsed(err)) return false
  return (
    status === 400 ||
    code === 'refresh_token_not_found' ||
    /invalid.?refresh.?token|refresh.?token.?not.?found|session.?not.?found/i.test(msg)
  )
}

/**
 * JWT ainda válido? (margem de 60s)
 * @param {{ access_token?: string; expires_at?: number } | null | undefined} session
 */
function jwtAindaValido(session) {
  if (!session?.access_token) return false
  if (typeof session.expires_at === 'number') {
    return session.expires_at * 1000 > Date.now() + 60_000
  }
  try {
    const payload = session.access_token.split('.')[1]
    if (!payload) return false
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    const exp = Number(json.exp)
    return Number.isFinite(exp) && exp * 1000 > Date.now() + 60_000
  } catch {
    return false
  }
}

/**
 * Lê sessão do localStorage (fallback quando getSession trava após idle no mobile).
 * @returns {{ data: { session: import('@supabase/supabase-js').Session | null }; error: null } | null}
 */
function lerSessaoLocalStorage() {
  if (typeof window === 'undefined') return null
  try {
    /** @type {Map<string, { idx: number; value: string }[]>} */
    const grouped = new Map()
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      const m = key?.match(/^(sb-[a-z0-9]+-auth-token)(?:\.(\d+))?$/)
      if (!m) continue
      const base = m[1]
      const idx = m[2] != null ? Number(m[2]) : 0
      const arr = grouped.get(base) ?? []
      arr.push({ idx, value: window.localStorage.getItem(key) ?? '' })
      grouped.set(base, arr)
    }
    if (grouped.size === 0) return null
    const chunks = [...grouped.values()][0]
    chunks.sort((a, b) => a.idx - b.idx)
    const joined = chunks.map((c) => c.value).join('')
    if (!joined) return null

    /** @type {Record<string, unknown>} */
    let parsed
    if (joined.startsWith('{')) {
      parsed = JSON.parse(joined)
    } else if (joined.startsWith('base64-')) {
      parsed = JSON.parse(atob(joined.slice(7)))
    } else {
      return null
    }

    const session =
      /** @type {import('@supabase/supabase-js').Session | null | undefined} */ (
        parsed?.currentSession ?? parsed?.session ?? parsed
      )
    if (!session?.access_token) return null
    return { data: { session }, error: null }
  } catch {
    return null
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
function aplicarDedupeAuth(client) {
  const origGetSession = client.auth.getSession.bind(client.auth)
  /** @type {Promise<Awaited<ReturnType<typeof origGetSession>>> | null} */
  let inflightSession = null
  /** @type {{ value: Awaited<ReturnType<typeof origGetSession>>; at: number } | null} */
  let cacheSession = null

  const origGetUser = client.auth.getUser.bind(client.auth)
  const origRefresh = client.auth.refreshSession.bind(client.auth)
  /** @type {Promise<Awaited<ReturnType<typeof origGetUser>>> | null} */
  let inflightUser = null

  /**
   * @returns {Promise<{ data: { user: import('@supabase/supabase-js').User | null }; error: null } | Awaited<ReturnType<typeof origGetUser>>>}
   */
  client.auth.getUser = async () => {
    // 1) Cache recente com user
    const cached = cacheSession?.value?.data?.session
    if (cacheSession && Date.now() - cacheSession.at < CACHE_MS && cached?.user) {
      return { data: { user: cached.user }, error: null }
    }

    // 2) Sessão local com JWT válido — evita GET /user desnecessário
    try {
      const sessRes = await origGetSession()
      const session = sessRes.data?.session
      if (session?.user && jwtAindaValido(session)) {
        cacheSession = { value: sessRes, at: Date.now() }
        return { data: { user: session.user }, error: null }
      }
      // 2b) JWT expirado — refresh (POST /token) antes de GET /user (menos 504 no Auth)
      if (session?.refresh_token && session?.user) {
        const { data: refreshed, error: refErr } = await origRefresh(session)
        if (!refErr && refreshed?.session?.user) {
          cacheSession = {
            value: { data: { session: refreshed.session }, error: null },
            at: Date.now(),
          }
          return { data: { user: refreshed.session.user }, error: null }
        }
      }
    } catch {
      /* segue para rede */
    }

    if (inflightUser) return inflightUser

    inflightUser = (async () => {
      try {
        const raced = await Promise.race([
          origGetUser(),
          new Promise((_, reject) => {
            setTimeout(() => {
              reject(Object.assign(new Error('auth getUser timeout'), { status: 504 }))
            }, GET_USER_TIMEOUT_MS)
          }),
        ])
        return /** @type {Awaited<ReturnType<typeof origGetUser>>} */ (raced)
      } catch (err) {
        if (isAuthTimeoutError(err)) {
          try {
            const sessRes = await origGetSession()
            const user = sessRes.data?.session?.user ?? null
            if (user) {
              console.warn('[auth] GET /user timeout — usando user da sessão local')
              return { data: { user }, error: null }
            }
          } catch {
            /* ignore */
          }
        }
        throw err
      } finally {
        inflightUser = null
      }
    })()

    return inflightUser
  }

  client.auth.getSession = async () => {
    const now = Date.now()
    if (cacheSession && now - cacheSession.at < CACHE_MS) {
      return cacheSession.value
    }
    if (inflightSession) return inflightSession

    inflightSession = (async () => {
      try {
        const raced = await Promise.race([
          origGetSession(),
          new Promise((_, reject) => {
            setTimeout(() => {
              reject(Object.assign(new Error('auth getSession timeout'), { status: 504 }))
            }, GET_SESSION_TIMEOUT_MS)
          }),
        ])
        const res = /** @type {Awaited<ReturnType<typeof origGetSession>>} */ (raced)
        cacheSession = { value: res, at: Date.now() }
        return res
      } catch (err) {
        if (isAuthTimeoutError(err)) {
          if (cacheSession?.value) {
            console.warn('[auth] getSession timeout — usando cache em memória')
            return cacheSession.value
          }
          const local = lerSessaoLocalStorage()
          if (local?.data?.session) {
            console.warn('[auth] getSession timeout — usando sessão do localStorage')
            cacheSession = { value: local, at: Date.now() }
            return local
          }
        }
        throw err
      } finally {
        inflightSession = null
      }
    })()

    return inflightSession
  }

  /** @type {Promise<Awaited<ReturnType<typeof origRefresh>>> | null} */
  let inflightRefresh = null
  client.auth.refreshSession = async (currentSession) => {
    if (inflightRefresh) return inflightRefresh

    const runRefresh = () =>
      origRefresh(currentSession)
        .then((res) => {
          if (res?.data?.session) {
            cacheSession = {
              value: { data: { session: res.data.session }, error: null },
              at: Date.now(),
            }
          } else {
            cacheSession = null
          }
          return res
        })
        .catch(async (err) => {
          // Em 504 do Auth, mantém sessão atual se ainda válida
          if (isAuthTimeoutError(err)) {
            console.warn('[auth] refreshSession timeout — mantendo sessão local')
            return origGetSession().then((sess) => ({
              data: { session: sess.data.session, user: sess.data.session?.user ?? null },
              error: null,
            }))
          }
          // Duas abas/refresh paralelo: token já rotacionado — espera o storage atualizar e relê
          if (isRefreshTokenAlreadyUsed(err)) {
            console.warn('[auth] refresh token already used — relendo sessão local')
            cacheSession = null
            await new Promise((r) => setTimeout(r, 180))
            const local = lerSessaoLocalStorage()
            if (local?.data?.session && jwtAindaValido(local.data.session)) {
              cacheSession = { value: local, at: Date.now() }
              return {
                data: {
                  session: local.data.session,
                  user: local.data.session.user ?? null,
                },
                error: null,
              }
            }
            const sess = await origGetSession()
            if (sess.data?.session) {
              return {
                data: { session: sess.data.session, user: sess.data.session.user ?? null },
                error: null,
              }
            }
          }
          // Refresh morto (400): limpa sessão local para não espalhar JWT inválido → 401 no REST
          if (isRefreshTokenInvalid(err)) {
            console.warn('[auth] refresh inválido — limpando sessão local')
            cacheSession = null
            try {
              await client.auth.signOut({ scope: 'local' })
            } catch {
              /* ignore */
            }
            return { data: { session: null, user: null }, error: null }
          }
          throw err
        })

    inflightRefresh = (async () => {
      try {
        if (typeof navigator !== 'undefined' && navigator.locks?.request) {
          return await navigator.locks.request('sb-auth-refresh', { mode: 'exclusive' }, () =>
            runRefresh(),
          )
        }
        return await runRefresh()
      } finally {
        inflightRefresh = null
      }
    })()

    return inflightRefresh
  }

  client.auth.onAuthStateChange((event) => {
    // TOKEN_REFRESHED já atualiza cache em refreshSession; limpar só em troca real de sessão
    if (event === 'TOKEN_REFRESHED') return
    cacheSession = null
  })
}

/**
 * Client só no browser: sessão completa em localStorage (JWT + refresh).
 * Melhora Safari / PWA onde cookies de auth falham intermitentemente.
 * Os cookies para o middleware são atualizados por `SupabaseCookieSync` + `/api/auth/sync-cookies`.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: typeof window !== 'undefined',
    flowType: 'pkce',
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
  realtime: {
    params: {
      eventsPerSecond: 2,
    },
  },
})

if (typeof window !== 'undefined') {
  aplicarDedupeAuth(supabase)
}
