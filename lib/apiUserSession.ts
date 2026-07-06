import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getUserFromCookieSession } from '@/lib/serverAuthSession'

export type UserSessionOk = {
  ok: true
  supabase: SupabaseClient
  userId: string
  email: string | null
  role: string | null
}

export type UserSessionFail = {
  ok: false
  error: NextResponse
}

export async function assertUserSession(): Promise<UserSessionOk | UserSessionFail> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {},
      },
    },
  )

  const { user, error: authErr } = await getUserFromCookieSession(supabase)

  if (authErr || !user) {
    return { ok: false, error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  }

  const { data: row } = await supabase.from('usuarios').select('role').eq('id', user.id).maybeSingle()

  return {
    ok: true,
    supabase,
    userId: user.id,
    email: user.email ?? null,
    role: row?.role != null ? String(row.role) : null,
  }
}
