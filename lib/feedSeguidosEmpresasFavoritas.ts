import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * `usuario_id` dos donos das empresas que o utilizador segue em `favoritos`
 * (mesma fonte que o botão Seguir na página da empresa).
 */
export async function fetchUsuarioIdsEmpresasFavoritas(
  supabase: SupabaseClient,
  meuId: string | null
): Promise<string[]> {
  if (!meuId) return []
  const { data: favs, error } = await supabase
    .from('favoritos')
    .select('empresa_id')
    .eq('usuario_id', meuId)
    .not('empresa_id', 'is', null)
  if (error || !favs?.length) return []
  const empIds = [...new Set(favs.map((f) => String((f as { empresa_id: unknown }).empresa_id)).filter(Boolean))]
  if (empIds.length === 0) return []
  const { data: emps, error: errE } = await supabase.from('empresas').select('usuario_id').in('id', empIds)
  if (errE || !emps?.length) return []
  return [...new Set(emps.map((e) => String((e as { usuario_id: unknown }).usuario_id)).filter(Boolean))]
}
