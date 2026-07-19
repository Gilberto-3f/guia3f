'use client'

import { useEffect, useRef } from 'react'
import { clearSessionCookiesOnServer, syncSessionCookiesToServer } from '@/lib/authCookieSync'
import { supabase } from '@/lib/supabase'

async function syncCookies(session: { access_token: string; refresh_token: string }) {
  const ok = await syncSessionCookiesToServer(session)
  if (!ok) {
    console.warn('[SupabaseCookieSync] falha ao sincronizar cookies')
  }
}

/**
 * Mantém cookies de sessão alinhados com o client em localStorage (PWA/Safari).
 * Só sincroniza no boot e em SIGNED_IN / TOKEN_REFRESHED (evita rajada em Auth).
 */
export default function SupabaseCookieSync() {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const schedule = (session: { access_token: string; refresh_token: string } | null) => {
      if (!session?.access_token || !session?.refresh_token) return
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null
        void syncCookies(session)
      }, 250)
    }

    void supabase.auth.getSession().then(({ data: { session } }) => {
      schedule(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        void clearSessionCookiesOnServer()
        return
      }
      // INITIAL_SESSION já é coberto pelo getSession do mount (evita POST duplo).
      if (event !== 'SIGNED_IN' && event !== 'TOKEN_REFRESHED') return
      if (!session) return
      schedule(session)
    })

    return () => {
      subscription.unsubscribe()
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return null
}
