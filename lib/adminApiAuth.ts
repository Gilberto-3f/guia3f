import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

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

  let rowUser: { role?: string | null; admin_level?: number | null } | null = null
  try {
    const adminDb = createSupabaseAdmin()
    const { data } = await adminDb
      .from('usuarios')
      .select('role, admin_level')
      .eq('id', user.id)
      .maybeSingle()
    rowUser = data
  } catch {
    const { data } = await supabase.from('usuarios').select('role, admin_level').eq('id', user.id).maybeSingle()
    rowUser = data
  }

  const role = String(rowUser?.role ?? '')
  const nivel = Number(rowUser?.admin_level ?? 0)
  if (role !== 'admin' && nivel < 1) {
    return { ok: false, error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) }
  }

  return { ok: true, supabase, userId: user.id }
}

/** Alinhado ao `useAdminGate`: sem `recursos` no JSON = acesso total; senão exige lista. */
export function adminPodeRecurso(
  adminPermissoes: unknown,
  adminLevel: number,
  role: string,
  recurso: string,
): boolean {
  const nivel = Number(adminLevel ?? 0)
  if (String(role) !== 'admin' && nivel < 1) return false
  const raw = adminPermissoes as { recursos?: string[] } | null
  const recursos = Array.isArray(raw?.recursos) ? raw.recursos : []
  if (recursos.length === 0) return true
  return recursos.includes('*') || recursos.includes(recurso)
}
