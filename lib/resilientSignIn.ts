import type { AuthError, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

/** Só falhas de conexão (request nem chegou); NÃO retentar timeout/504 do Auth. */
const RETRYABLE_NETWORK_RE =
  /failed to fetch|networkerror|load failed|err_failed|network request failed|fetch failed/i
const NON_RETRYABLE_RE = /timeout|deadline|504|503|502|500|context canceled|context cancelled/i

function isRetryableNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && /fetch/i.test(err.message) && !NON_RETRYABLE_RE.test(err.message)) {
    return true
  }
  if (!(err instanceof Error)) return false
  const msg = err.message
  if (NON_RETRYABLE_RE.test(msg)) return false
  return RETRYABLE_NETWORK_RE.test(msg)
}

function isAuthServerOverload(error: AuthError): boolean {
  const status = typeof error.status === 'number' ? error.status : 0
  if (status >= 500) return true
  return NON_RETRYABLE_RE.test(String(error.message ?? ''))
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function readSession(): Promise<Session | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token || !session.refresh_token) return null
  return session
}

export type ResilientSignInResult =
  | { ok: true; session: Session }
  | { ok: false; kind: 'auth'; error: AuthError }
  | { ok: false; kind: 'network' }

/**
 * Login com retry só em falha de rede (offline).
 * Não triplica POST /token quando o Auth responde 5xx/timeout.
 */
export async function signInWithPasswordResilient(
  email: string,
  password: string,
): Promise<ResilientSignInResult> {
  const maxAttempts = 3
  let lastNetworkError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        if (isAuthServerOverload(error)) {
          const recovered = await readSession()
          if (recovered) return { ok: true, session: recovered }
          return { ok: false, kind: 'network' }
        }
        return { ok: false, kind: 'auth', error }
      }
      if (data.session) return { ok: true, session: data.session }

      const recovered = await readSession()
      if (recovered) return { ok: true, session: recovered }

      return {
        ok: false,
        kind: 'auth',
        error: { message: 'missing_session', name: 'AuthApiError', status: 500 } as AuthError,
      }
    } catch (err) {
      if (!isRetryableNetworkError(err)) {
        if (err instanceof Error && NON_RETRYABLE_RE.test(err.message)) {
          const recovered = await readSession()
          if (recovered) return { ok: true, session: recovered }
          return { ok: false, kind: 'network' }
        }
        throw err
      }
      lastNetworkError = err

      const recovered = await readSession()
      if (recovered) return { ok: true, session: recovered }

      if (attempt < maxAttempts) {
        await sleep(350 * attempt)
      }
    }
  }

  const recovered = await readSession()
  if (recovered) return { ok: true, session: recovered }

  if (lastNetworkError) {
    return { ok: false, kind: 'network' }
  }

  return {
    ok: false,
    kind: 'auth',
    error: { message: 'missing_session', name: 'AuthApiError', status: 500 } as AuthError,
  }
}
