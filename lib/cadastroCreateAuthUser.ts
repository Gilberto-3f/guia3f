import type { User } from '@supabase/supabase-js'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

export type CadastroAuthRole = 'turista' | 'profissional' | 'empresa'

type AdminClient = ReturnType<typeof createSupabaseAdmin>

function isDatabaseAuthError(message: string): boolean {
  const m = message.toLowerCase()
  return m.includes('database error') || m.includes('unexpected_failure')
}

function isEmailTaken(message: string): boolean {
  const m = message.toLowerCase()
  return m.includes('already') || m.includes('registered') || m.includes('exists')
}

/**
 * Cria usuário no Auth. Se o trigger em `usuarios` falhar com role profissional/empresa,
 * tenta de novo como turista; a rota deve fazer upsert em `usuarios` com o role final.
 */
export async function createAuthUserForCadastro(
  admin: AdminClient,
  params: { email: string; password: string; role: CadastroAuthRole }
): Promise<
  | { ok: true; user: User; authRoleUsed: CadastroAuthRole }
  | { ok: false; error: string; kind: 'email_exists' | 'auth_database_error' | 'other' }
> {
  const roles: CadastroAuthRole[] =
    params.role === 'turista' ? ['turista'] : [params.role, 'turista']

  let lastMessage = ''

  for (const role of roles) {
    const { data, error } = await admin.auth.admin.createUser({
      email: params.email,
      password: params.password,
      email_confirm: true,
      user_metadata: { role },
    })

    if (!error && data.user?.id) {
      return { ok: true, user: data.user, authRoleUsed: role }
    }

    const message = error?.message ?? 'Erro ao criar usuário'
    lastMessage = message

    if (isEmailTaken(message)) {
      return { ok: false, error: message, kind: 'email_exists' }
    }

    if (!isDatabaseAuthError(message)) {
      return { ok: false, error: message, kind: 'other' }
    }
  }

  return {
    ok: false,
    error: lastMessage,
    kind: 'auth_database_error',
  }
}

export async function upsertUsuarioCadastro(
  admin: AdminClient,
  params: { id: string; email: string; role: CadastroAuthRole }
): Promise<{ error: string | null }> {
  const { error } = await admin.from('usuarios').upsert(
    {
      id: params.id,
      email: params.email,
      role: params.role,
      status: 'pre_aprovado',
    },
    { onConflict: 'id' }
  )
  return { error: error?.message ?? null }
}
