import { syncSessionCookiesToServer } from '@/lib/authCookieSync'
import { supabase } from '@/lib/supabase'

/** Evita tempestade focus+visibility+pageshow após idle. */
const RESUME_COOLDOWN_MS = 30_000
/** Se o JWT ainda vale mais que isso, só alinha cookies — sem refresh. */
const JWT_SKIP_REFRESH_MS = 180_000
/** Só desconecta Realtime após ficar oculto por este tempo (evita churn do pool). */
const REALTIME_PAUSE_AFTER_MS = 45_000

let lastResumeAt = 0
let inflightResume: Promise<void> | null = null

function jwtExpMs(session: { access_token?: string; expires_at?: number }): number | null {
  if (!session?.access_token) return null
  if (typeof session.expires_at === 'number') return session.expires_at * 1000
  try {
    const payload = session.access_token.split('.')[1]
    if (!payload) return null
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    const exp = Number(json.exp)
    return Number.isFinite(exp) ? exp * 1000 : null
  } catch {
    return null
  }
}

/**
 * PWA/mobile: ao voltar do idle, renova tokens (se necessário) e alinha cookies HttpOnly.
 * Debounce agressivo — focus/visibility/pageshow não disparam refresh em cascata.
 */
export async function resumirSessaoAposIdle(): Promise<void> {
  if (typeof window === 'undefined') return
  if (document.visibilityState !== 'visible') return

  const now = Date.now()
  if (inflightResume) {
    await inflightResume
    return
  }
  if (now - lastResumeAt < RESUME_COOLDOWN_MS) return
  lastResumeAt = now

  inflightResume = (async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token || !session.refresh_token) return

      const expMs = jwtExpMs(session)
      const aindaFresco = expMs != null && expMs - now > JWT_SKIP_REFRESH_MS

      if (!aindaFresco) {
        const { data: refreshed, error } = await supabase.auth.refreshSession(session)
        if (error) {
          console.warn('[authResume] refreshSession:', error.message)
          // Não reenvia JWT morto aos cookies / REST (evita 401 em massa).
          return
        }
        const s = refreshed?.session
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

/**
 * Pausa Realtime só após idle prolongado — evita Disconnecting broadcast em cascata.
 */
function registrarPausaRealtimeEmBackground(): () => void {
  if (typeof window === 'undefined') return () => {}

  let hideTimer: ReturnType<typeof setTimeout> | null = null

  const onVis = () => {
    try {
      if (document.visibilityState === 'hidden') {
        if (hideTimer) clearTimeout(hideTimer)
        hideTimer = setTimeout(() => {
          try {
            supabase.realtime.disconnect()
          } catch {
            /* ignore */
          }
        }, REALTIME_PAUSE_AFTER_MS)
      } else {
        if (hideTimer) {
          clearTimeout(hideTimer)
          hideTimer = null
        }
        try {
          supabase.realtime.connect()
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      console.warn('[authResume] realtime pause/resume', err)
    }
  }

  document.addEventListener('visibilitychange', onVis)
  return () => {
    if (hideTimer) clearTimeout(hideTimer)
    document.removeEventListener('visibilitychange', onVis)
  }
}

/** Registra listeners de retorno ao app (visibility + bfcache iOS). Sem `focus` (muito barulhento). */
export function registrarResumoSessaoAoVoltar(): () => void {
  if (typeof window === 'undefined') return () => {}

  const onResume = () => {
    if (document.visibilityState !== 'visible') return
    void resumirSessaoAposIdle()
  }

  document.addEventListener('visibilitychange', onResume)
  window.addEventListener('pageshow', onResume)

  const unsubRealtime = registrarPausaRealtimeEmBackground()

  void resumirSessaoAposIdle()

  return () => {
    document.removeEventListener('visibilitychange', onResume)
    window.removeEventListener('pageshow', onResume)
    unsubRealtime()
  }
}
