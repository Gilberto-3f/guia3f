import { syncSessionCookiesToServer } from '@/lib/authCookieSync'
import { supabase } from '@/lib/supabase'

const RESUME_DEBOUNCE_MS = 500

let lastResumeAt = 0
let inflightResume: Promise<void> | null = null

function jwtValidoComMargem(session: { access_token?: string; expires_at?: number }): boolean {
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
 * PWA/mobile: ao voltar do idle, renova tokens e alinha cookies HttpOnly (middleware).
 * Sem isso, rotas protegidas redirecionam para /login mesmo com sessão no localStorage.
 */
export async function resumirSessaoAposIdle(): Promise<void> {
  if (typeof window === 'undefined') return
  if (document.visibilityState !== 'visible') return

  const now = Date.now()
  if (inflightResume && now - lastResumeAt < RESUME_DEBOUNCE_MS) {
    await inflightResume
    return
  }
  lastResumeAt = now

  if (inflightResume) {
    await inflightResume
    return
  }

  inflightResume = (async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token || !session.refresh_token) return

      if (!jwtValidoComMargem(session)) {
        const { data: refreshed, error } = await supabase.auth.refreshSession(session)
        if (error) {
          console.warn('[authResume] refreshSession:', error.message)
        }
        const s = refreshed.session ?? session
        if (s?.access_token && s.refresh_token) {
          await syncSessionCookiesToServer(s)
        }
        return
      }

      await syncSessionCookiesToServer(session)
    } catch (err) {
      console.warn('[authResume] falha ao resumir sessão', err)
    }
  })()

  try {
    await inflightResume
  } finally {
    inflightResume = null
  }
}

/** Registra listeners de retorno ao app (visibility + bfcache iOS). */
export function registrarResumoSessaoAoVoltar(): () => void {
  if (typeof window === 'undefined') return () => {}

  const onResume = () => {
    if (document.visibilityState !== 'visible') return
    void resumirSessaoAposIdle()
  }

  document.addEventListener('visibilitychange', onResume)
  window.addEventListener('pageshow', onResume)
  window.addEventListener('focus', onResume)

  void resumirSessaoAposIdle()

  return () => {
    document.removeEventListener('visibilitychange', onResume)
    window.removeEventListener('pageshow', onResume)
    window.removeEventListener('focus', onResume)
  }
}
