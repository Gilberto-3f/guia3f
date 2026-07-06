import type { SupabaseClient, User } from '@supabase/supabase-js'

/**
 * Lê o usuário da sessão em cookie (sem GET /auth/v1/user).
 * Preferir a rotas API e Server Components para reduzir 504 no Auth.
 */
export async function getUserFromCookieSession(
  supabase: SupabaseClient,
): Promise<{ user: User | null; error: Error | null }> {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    return { user: null, error }
  }
  return { user: data.session?.user ?? null, error: null }
}
