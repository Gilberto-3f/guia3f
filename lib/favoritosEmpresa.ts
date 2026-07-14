import type { SupabaseClient } from '@supabase/supabase-js'

const TIPO_EMPRESA = 'empresa'

/** Payload de insert: schema `favoritos` com `alvo_id` + `alvo_tipo` (sem `empresa_id`). */
export function payloadFavoritoEmpresa(usuarioId: string, empresaId: string) {
  return {
    usuario_id: usuarioId,
    alvo_id: empresaId,
    alvo_tipo: TIPO_EMPRESA,
    // Compatível com schema legado que ainda exige empresa_id preenchido.
    empresa_id: empresaId,
  }
}

/**
 * Verifica se o utilizador segue a empresa.
 */
export async function usuarioSegueEmpresa(
  supabase: SupabaseClient,
  usuarioId: string,
  empresaId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('favoritos')
    .select('id')
    .eq('usuario_id', String(usuarioId))
    .eq('alvo_id', String(empresaId))
    .eq('alvo_tipo', TIPO_EMPRESA)
    .limit(1)

  if (error) {
    console.error('[favoritosEmpresa] usuarioSegueEmpresa:', error.message)
    return false
  }

  return (data ?? []).length > 0
}

/** Remove favorito da empresa. */
export async function deletarFavoritoEmpresa(
  supabase: SupabaseClient,
  usuarioId: string,
  empresaId: string
) {
  const { error } = await supabase
    .from('favoritos')
    .delete()
    .eq('usuario_id', String(usuarioId))
    .eq('alvo_id', String(empresaId))
    .eq('alvo_tipo', TIPO_EMPRESA)

  if (error) throw error
}

/** Contagem de seguidores únicos da empresa. */
export async function contarSeguidoresEmpresa(
  supabase: SupabaseClient,
  empresaId: string
): Promise<number> {
  const ids = await listarUsuarioIdsSeguidoresEmpresa(supabase, empresaId)
  return ids.length
}

/** IDs de utilizadores que seguem a empresa. */
export async function listarUsuarioIdsSeguidoresEmpresa(
  supabase: SupabaseClient,
  empresaId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('favoritos')
    .select('usuario_id')
    .eq('alvo_id', String(empresaId))
    .eq('alvo_tipo', TIPO_EMPRESA)

  if (error) {
    console.error('[favoritosEmpresa] listarUsuarioIdsSeguidoresEmpresa:', error.message)
    throw error
  }

  const ids = new Set<string>()
  for (const row of data ?? []) {
    const uid = row.usuario_id != null ? String(row.usuario_id) : ''
    if (uid) ids.add(uid)
  }
  return [...ids]
}

/** Subconjunto de `empresaIds` que o utilizador segue (uma query). */
export async function filtrarEmpresaIdsSeguidasPorUsuario(
  supabase: SupabaseClient,
  usuarioId: string,
  empresaIds: string[]
): Promise<Set<string>> {
  const ids = [...new Set(empresaIds.map((id) => String(id).trim()).filter(Boolean))]
  if (!ids.length) return new Set()

  const { data, error } = await supabase
    .from('favoritos')
    .select('alvo_id')
    .eq('usuario_id', String(usuarioId))
    .eq('alvo_tipo', TIPO_EMPRESA)
    .in('alvo_id', ids)

  if (error) {
    console.error('[favoritosEmpresa] filtrarEmpresaIdsSeguidasPorUsuario:', error.message)
    return new Set()
  }

  const seguidas = new Set<string>()
  for (const row of data ?? []) {
    const eid = row.alvo_id != null ? String(row.alvo_id).trim() : ''
    if (eid) seguidas.add(eid)
  }
  return seguidas
}

/** IDs de empresas seguidas/favoritadas por um utilizador. */
export async function listarEmpresaIdsFavoritasPorUsuario(
  supabase: SupabaseClient,
  usuarioId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('favoritos')
    .select('alvo_id')
    .eq('usuario_id', String(usuarioId))
    .eq('alvo_tipo', TIPO_EMPRESA)

  if (error) {
    console.error('[favoritosEmpresa] listarEmpresaIdsFavoritasPorUsuario:', error.message)
    throw error
  }

  const ids = new Set<string>()
  for (const row of data ?? []) {
    const eid = row.alvo_id != null ? String(row.alvo_id).trim() : ''
    if (eid) ids.add(eid)
  }
  return [...ids]
}
