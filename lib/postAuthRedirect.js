/**
 * Redirecionamento pós-login / pós-magic-link conforme perfil em `usuarios` e tabelas de cadastro.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @returns {Promise<string>}
 */
export async function getPostAuthRedirectPath(supabase, userId) {
  if (!userId) return '/login'

  const [{ data: u, error: eu }, { data: tur }, { data: pro }, { data: emp }] = await Promise.all([
    supabase.from('usuarios').select('role').eq('id', userId).maybeSingle(),
    supabase.from('turistas').select('id').eq('usuario_id', userId).maybeSingle(),
    supabase.from('profissionais').select('id').eq('usuario_id', userId).maybeSingle(),
    supabase.from('empresas').select('id').eq('usuario_id', userId).maybeSingle(),
  ])

  if (eu || !u) return '/escolha-perfil'

  const role = u.role != null ? String(u.role) : ''

  if (role === 'admin') {
    return '/guia'
  }

  if (role === 'profissional') {
    return pro ? '/guia' : '/escolha-perfil'
  }

  if (role === 'empresa') {
    return emp ? '/guia' : '/escolha-perfil'
  }

  if (role === 'turista') {
    const temPerfil = Boolean(tur || pro || emp)
    return temPerfil ? '/guia' : '/escolha-perfil'
  }

  return '/guia'
}

/**
 * Precisa completar cadastro em /escolha-perfil antes de usar o app principal.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export async function isProfileIncomplete(supabase, userId) {
  const path = await getPostAuthRedirectPath(supabase, userId)
  return path === '/escolha-perfil'
}

/**
 * Rotas do app-shell que exigem cadastro detalhado completo.
 */
export const ROTAS_EXIGEM_PERFIL_COMPLETO = [
  '/guia',
  '/feed',
  '/perfil',
  '/atividades',
  '/canal',
  '/dashboard',
]
