import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { getUserFromCookieSession } from '@/lib/serverAuthSession'

export type AdminSessionOk = {
  ok: true
  supabase: SupabaseClient
  userId: string
  email: string | null
}

export type AdminSessionFail = {
  ok: false
  error: NextResponse
}

export type AdminSessionResult = AdminSessionOk | AdminSessionFail

export type AdminUsuarioRow = {
  id: string
  email: string | null
  role: string | null
  admin_level: number | null
  admin_permissoes: unknown
}

const ADMIN_USUARIO_SELECT = 'id, email, role, admin_level, admin_permissoes'

export function jsonAdminError(
  status: number,
  step: string,
  error: string,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json({ error, step, ...extra }, { status })
}

function isAdminRole(role: string, nivel: number): boolean {
  return role === 'admin' || nivel >= 1
}

/**
 * Carrega linha do admin em `usuarios` (service role).
 * Se `auth.uid` não existir em usuarios, tenta pelo e-mail do Auth (IDs divergentes).
 */
export async function loadAdminUsuarioRow(
  authUserId: string,
  authEmail?: string | null,
): Promise<{ row: AdminUsuarioRow | null; actorId: string; dbError: string | null }> {
  let adminDb: SupabaseClient
  try {
    adminDb = createSupabaseAdmin()
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'service_role_unavailable'
    console.error('[loadAdminUsuarioRow] createSupabaseAdmin', msg)
    return { row: null, actorId: authUserId, dbError: msg }
  }

  const { data: byId, error: errId } = await adminDb
    .from('usuarios')
    .select(ADMIN_USUARIO_SELECT)
    .eq('id', authUserId)
    .maybeSingle()

  if (errId) {
    console.error('[loadAdminUsuarioRow] select by id', { authUserId, message: errId.message })
    return { row: null, actorId: authUserId, dbError: errId.message }
  }

  if (byId) {
    return {
      row: byId as AdminUsuarioRow,
      actorId: String(byId.id),
      dbError: null,
    }
  }

  const email = authEmail?.trim()
  if (!email) {
    return { row: null, actorId: authUserId, dbError: null }
  }

  const { data: byEmail, error: errEmail } = await adminDb
    .from('usuarios')
    .select(ADMIN_USUARIO_SELECT)
    .eq('email', email)
    .maybeSingle()

  if (errEmail) {
    console.error('[loadAdminUsuarioRow] select by email', { email, message: errEmail.message })
    return { row: null, actorId: authUserId, dbError: errEmail.message }
  }

  if (!byEmail) {
    return { row: null, actorId: authUserId, dbError: null }
  }

  const role = String(byEmail.role ?? '')
  const nivel = Number(byEmail.admin_level ?? 0)
  if (!isAdminRole(role, nivel)) {
    return { row: null, actorId: authUserId, dbError: null }
  }

  console.warn('[loadAdminUsuarioRow] auth.uid sem linha em usuarios; usando match por email', {
    authUserId,
    usuariosId: byEmail.id,
    email,
  })

  return {
    row: byEmail as AdminUsuarioRow,
    actorId: String(byEmail.id),
    dbError: null,
  }
}

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

  const { user, error: authErr } = await getUserFromCookieSession(supabase)

  if (authErr) {
    console.error('[assertAdminSession] getSession', authErr.message)
    return {
      ok: false,
      error: jsonAdminError(401, 'auth', 'Sessão inválida ou expirada. Faça login novamente no painel ADM.'),
    }
  }

  if (!user) {
    return {
      ok: false,
      error: jsonAdminError(401, 'auth', 'Não autenticado. Faça login novamente no painel ADM.'),
    }
  }

  const { row, dbError } = await loadAdminUsuarioRow(user.id, user.email)

  if (dbError) {
    return {
      ok: false,
      error: jsonAdminError(503, 'load_admin', `Falha ao consultar usuarios: ${dbError}`),
    }
  }

  if (!row) {
    return {
      ok: false,
      error: jsonAdminError(
        403,
        'admin_profile',
        'Perfil ADM não encontrado em usuarios para este login. Verifique se auth.users.id coincide com usuarios.id (ou o mesmo e-mail).',
        { authUserId: user.id },
      ),
    }
  }

  const role = String(row.role ?? '')
  const nivel = Number(row.admin_level ?? 0)
  if (!isAdminRole(role, nivel)) {
    return {
      ok: false,
      error: jsonAdminError(
        403,
        'admin_role',
        'Usuário autenticado sem permissão de administrador (role ou admin_level).',
      ),
    }
  }

  return {
    ok: true,
    supabase,
    userId: user.id,
    email: user.email ?? row.email ?? null,
  }
}

/** ADM GERAL (nível 1) ou lista vazia = acesso total; senão exige recurso na lista. */
export function adminPodeRecurso(
  adminPermissoes: unknown,
  adminLevel: number,
  role: string,
  recurso: string,
): boolean {
  const nivel = Number(adminLevel ?? 0)
  if (String(role) !== 'admin' && nivel < 1) return false
  if (nivel === 1) return true
  const raw = adminPermissoes as { recursos?: string[] } | null
  const recursos = Array.isArray(raw?.recursos) ? raw.recursos : []
  if (recursos.length === 0) return true
  return recursos.includes('*') || recursos.includes(recurso)
}
