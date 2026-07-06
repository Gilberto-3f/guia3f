import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '@supabase: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY (veja o dashboard do projeto)'
  )
}

/**
 * Evita rajadas de GET /user (504) quando vários componentes chamam getSession/refresh ao mesmo tempo.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
function aplicarDedupeAuth(client) {
  const origGetSession = client.auth.getSession.bind(client.auth)
  /** @type {Promise<Awaited<ReturnType<typeof origGetSession>>> | null} */
  let inflightSession = null
  /** @type {{ value: Awaited<ReturnType<typeof origGetSession>>; at: number } | null} */
  let cacheSession = null
  const CACHE_MS = 20_000

  const origGetUser = client.auth.getUser.bind(client.auth)
  /** @type {Promise<Awaited<ReturnType<typeof origGetUser>>> | null} */
  let inflightUser = null
  client.auth.getUser = async () => {
    const cached = cacheSession?.value?.data?.session
    if (cacheSession && Date.now() - cacheSession.at < CACHE_MS && cached?.user) {
      return { data: { user: cached.user }, error: null }
    }
    if (inflightUser) return inflightUser
    inflightUser = origGetUser()
      .then((res) => {
        inflightUser = null
        return res
      })
      .catch((err) => {
        inflightUser = null
        throw err
      })
    return inflightUser
  }

  client.auth.getSession = async () => {
    const now = Date.now()
    if (cacheSession && now - cacheSession.at < CACHE_MS) {
      return cacheSession.value
    }
    if (inflightSession) return inflightSession
    inflightSession = origGetSession()
      .then((res) => {
        cacheSession = { value: res, at: Date.now() }
        inflightSession = null
        return res
      })
      .catch((err) => {
        inflightSession = null
        throw err
      })
    return inflightSession
  }

  const origRefresh = client.auth.refreshSession.bind(client.auth)
  /** @type {Promise<Awaited<ReturnType<typeof origRefresh>>> | null} */
  let inflightRefresh = null
  client.auth.refreshSession = async (currentSession) => {
    if (inflightRefresh) return inflightRefresh
    inflightRefresh = origRefresh(currentSession)
      .then((res) => {
        inflightRefresh = null
        cacheSession = null
        return res
      })
      .catch((err) => {
        inflightRefresh = null
        throw err
      })
    return inflightRefresh
  }

  client.auth.onAuthStateChange(() => {
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
      eventsPerSecond: 4,
    },
  },
})

if (typeof window !== 'undefined') {
  aplicarDedupeAuth(supabase)
}
