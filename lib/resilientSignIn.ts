import type { AuthError, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

const NETWORK_ERROR_RE = /failed to fetch|networkerror|load failed|err_failed|network request failed/i

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && /fetch/i.test(err.message)) return true
  if (err instanceof Error && NETWORK_ERROR_RE.test(err.message)) return true
  return false
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
 * Login com retry em falhas transitórias de rede e recuperação de sessão
 * quando o token foi gravado no cliente mas a resposta HTTP falhou.
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
      if (error) return { ok: false, kind: 'auth', error }
      if (data.session) return { ok: true, session: data.session }

      const recovered = await readSession()
      if (recovered) return { ok: true, session: recovered }

      return {
        ok: false,
        kind: 'auth',
        error: { message: 'missing_session', name: 'AuthApiError', status: 500 } as AuthError,
      }
    } catch (err) {
      if (!isNetworkError(err)) throw err
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
