import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

export type AdminSessionOk = {
  ok: true
  supabase: SupabaseClient
  userId: string
}

export type AdminSessionFail = {
  ok: false
  error: NextResponse
}

export type AdminSessionResult = AdminSessionOk | AdminSessionFail

/** Sessão autenticada com role admin (rotas /api/admin/*). */
export async function assertAdminSession(): Promise<AdminSessionResult> {
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

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()
  if (authErr || !user) {
    return { ok: false, error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  }

  const { data: rowUser } = await supabase.from('usuarios').select('role').eq('id', user.id).maybeSingle()
  if (String(rowUser?.role ?? '') !== 'admin') {
    return { ok: false, error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) }
  }

  return { ok: true, supabase, userId: user.id }
}
