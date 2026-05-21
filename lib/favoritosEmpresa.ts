import type { SupabaseClient } from '@supabase/supabase-js'

/** Payload de insert alinhado ao schema legado (`empresa_id`) e ao modelo atual (`alvo_id`). */
export function payloadFavoritoEmpresa(usuarioId: string, empresaId: string) {
  return {
    usuario_id: usuarioId,
    empresa_id: empresaId,
    alvo_id: empresaId,
    alvo_tipo: 'empresa' as const,
  }
}

/**
 * Verifica se o utilizador segue a empresa (linhas com `alvo_id` ou só `empresa_id` legado).
 */
export async function usuarioSegueEmpresa(
  supabase: SupabaseClient,
  usuarioId: string,
  empresaId: string
): Promise<boolean> {
  const [porAlvo, porEmpresa] = await Promise.all([
    supabase
      .from('favoritos')
      .select('id')
      .eq('usuario_id', usuarioId)
      .eq('alvo_id', empresaId)
      .eq('alvo_tipo', 'empresa')
      .maybeSingle(),
    supabase.from('favoritos').select('id').eq('usuario_id', usuarioId).eq('empresa_id', empresaId).maybeSingle(),
  ])
  return Boolean(porAlvo.data || porEmpresa.data)
}

/** Remove favorito da empresa (ambos os formatos de coluna). */
export async function deletarFavoritoEmpresa(
  supabase: SupabaseClient,
  usuarioId: string,
  empresaId: string
) {
  await Promise.all([
    supabase
      .from('favoritos')
      .delete()
      .eq('usuario_id', usuarioId)
      .eq('alvo_id', empresaId)
      .eq('alvo_tipo', 'empresa'),
    supabase.from('favoritos').delete().eq('usuario_id', usuarioId).eq('empresa_id', empresaId),
  ])
}

/** Contagem de seguidores únicos (deduplica legado + modelo `alvo_id`). */
export async function contarSeguidoresEmpresa(
  supabase: SupabaseClient,
  empresaId: string
): Promise<number> {
  const [porAlvo, porEmpresa] = await Promise.all([
    supabase
      .from('favoritos')
      .select('usuario_id')
      .eq('alvo_id', empresaId)
      .eq('alvo_tipo', 'empresa'),
    supabase.from('favoritos').select('usuario_id').eq('empresa_id', empresaId),
  ])
  const ids = new Set<string>()
  for (const row of porAlvo.data ?? []) {
    const uid = row?.usuario_id != null ? String(row.usuario_id) : ''
    if (uid) ids.add(uid)
  }
  for (const row of porEmpresa.data ?? []) {
    const uid = row?.usuario_id != null ? String(row.usuario_id) : ''
    if (uid) ids.add(uid)
  }
  return ids.size
}

/** IDs de utilizadores que seguem a empresa. */
export async function listarUsuarioIdsSeguidoresEmpresa(
  supabase: SupabaseClient,
  empresaId: string
): Promise<string[]> {
  const [porAlvo, porEmpresa] = await Promise.all([
    supabase
      .from('favoritos')
      .select('usuario_id')
      .eq('alvo_id', empresaId)
      .eq('alvo_tipo', 'empresa'),
    supabase.from('favoritos').select('usuario_id').eq('empresa_id', empresaId),
  ])
  const ids = new Set<string>()
  for (const row of porAlvo.data ?? []) {
    const uid = row?.usuario_id != null ? String(row.usuario_id) : ''
    if (uid) ids.add(uid)
  }
  for (const row of porEmpresa.data ?? []) {
    const uid = row?.usuario_id != null ? String(row.usuario_id) : ''
    if (uid) ids.add(uid)
  }
  return [...ids]
}
