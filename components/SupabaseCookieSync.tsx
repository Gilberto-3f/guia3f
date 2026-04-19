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
 * O middleware continua usando cookies; o JWT nas queries REST vem do client.
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
      }, 200)
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
