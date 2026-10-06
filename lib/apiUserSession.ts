import { NextResponse } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { getUserFromCookieSession } from '@/lib/serverAuthSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { gravarRoleCache, lerRoleCache, roleAppValida } from '@/lib/perfilSessaoCache'

function roleDoJwt(user: User): string | null {
  return roleAppValida(
    (typeof user.app_metadata?.role === 'string' ? user.app_metadata.role : null) ??
      (typeof user.user_metadata?.role === 'string' ? user.user_metadata.role : null),
  )
}

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

/**
 * Sessão via cookie/JWT apenas — sem GET /auth/v1/user e sem createServerClient.
 * Usar em rotas quentes (mapa/poll) para não amplificar cascata de 504/522.
 */
export async function assertUserSessionLight(): Promise<
  { ok: true; userId: string } | UserSessionFail
> {
  const { user, error: authErr } = await getUserFromCookieSession()
  if (authErr || !user) {
    return { ok: false, error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  }
  return { ok: true, userId: user.id }
}

/**
 * JWT do cookie + admin (service role). Nunca chama GoTrue /auth/v1/user.
 * As rotas continuam filtrando por `userId`; o admin só evita o getUser do SSR client.
 */
export async function assertUserSession(): Promise<UserSessionOk | UserSessionFail> {
  const { user, error: authErr } = await getUserFromCookieSession()
  if (authErr || !user) {
    return { ok: false, error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  }

  let supabase: SupabaseClient
  try {
    supabase = createSupabaseAdmin()
  } catch {
    return { ok: false, error: NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 }) }
  }

  let role = roleDoJwt(user) ?? (await lerRoleCache(user.id))
  if (role == null) {
    const { data: row } = await supabase.from('usuarios').select('role').eq('id', user.id).maybeSingle()
    role = row?.role != null ? String(row.role) : null
    if (role && role !== 'authenticated') await gravarRoleCache(user.id, role)
  }

  return {
    ok: true,
    supabase,
    userId: user.id,
    email: user.email ?? null,
    role,
  }
}
