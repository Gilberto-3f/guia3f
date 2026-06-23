import type { SupabaseClient } from '@supabase/supabase-js'

/** URL da página pública da empresa logada; null se o utilizador não for empresa. */
export async function obterUrlPosPublicacaoEmpresa(
  supabase: SupabaseClient,
): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const uid = session?.user?.id
  if (!uid) return null

  const { data: usuario } = await supabase.from('usuarios').select('role').eq('id', uid).maybeSingle()
  if (String(usuario?.role ?? '') !== 'empresa') return null

  const { data: empresa } = await supabase.from('empresas').select('id').eq('usuario_id', uid).maybeSingle()
  const id = empresa?.id != null ? String(empresa.id) : null
  return id ? `/empresa/${id}` : null
}
