'use client'

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

async function syncCookies(session: { access_token: string; refresh_token: string }) {
  const res = await fetch('/api/auth/sync-cookies', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    }),
  })
  if (!res.ok) {
    const j = (await res.json().catch(() => null)) as { error?: string } | null
    console.warn('[SupabaseCookieSync]', res.status, j?.error ?? res.statusText)
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
      if (event === 'SIGNED_OUT') return
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
