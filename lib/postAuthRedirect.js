/**
 * Destino após login / magic link / callback OAuth.
 * `/escolha-perfil` fica só no fluxo explícito (botão "Criar conta" no login), não aqui.
 * @param {import('@supabase/supabase-js').SupabaseClient} _supabase
 * @param {string} userId
 * @returns {Promise<string>}
 */
export async function getPostAuthRedirectPath(_supabase, userId) {
  if (!userId) return '/login'
  return '/guia'
}
