import type { SupabaseClient } from '@supabase/supabase-js'

type FavoritoRow = {
  id?: string
  usuario_id?: string
  empresa_id?: string | null
  alvo_id?: string | null
  alvo_tipo?: string | null
}

/** Payload de insert alinhado ao schema legado (`empresa_id`) e ao modelo atual (`alvo_id`). */
export function payloadFavoritoEmpresa(usuarioId: string, empresaId: string) {
  return {
    usuario_id: usuarioId,
    empresa_id: empresaId,
    alvo_id: empresaId,
    alvo_tipo: 'empresa' as const,
  }
}

/** Linha de favorito corresponde a seguir esta empresa (legado + `alvo_id`). */
export function favoritoSegueEmpresa(row: FavoritoRow, empresaId: string): boolean {
  const eid = String(empresaId)
  if (row.empresa_id != null && String(row.empresa_id) === eid) return true
  if (row.alvo_id != null && String(row.alvo_id) === eid) {
    const tipo = row.alvo_tipo != null ? String(row.alvo_tipo).toLowerCase() : ''
    return tipo === '' || tipo === 'empresa'
  }
  return false
}

/**
 * Verifica se o utilizador segue a empresa.
 * Não usa `maybeSingle()` — duplicatas legadas fazem essa API devolver vazio com erro.
 */
export async function usuarioSegueEmpresa(
  supabase: SupabaseClient,
  usuarioId: string,
  empresaId: string
): Promise<boolean> {
  const eid = String(empresaId)
  const uid = String(usuarioId)

  const { data, error } = await supabase
    .from('favoritos')
    .select('id, empresa_id, alvo_id, alvo_tipo')
    .eq('usuario_id', uid)
    .or(`empresa_id.eq.${eid},alvo_id.eq.${eid}`)

  if (error) {
    const [porAlvo, porEmpresa] = await Promise.all([
      supabase
        .from('favoritos')
        .select('id, empresa_id, alvo_id, alvo_tipo')
        .eq('usuario_id', uid)
        .eq('alvo_id', eid),
      supabase
        .from('favoritos')
        .select('id, empresa_id, alvo_id, alvo_tipo')
        .eq('usuario_id', uid)
        .eq('empresa_id', eid),
    ])
    const rows = [...(porAlvo.data ?? []), ...(porEmpresa.data ?? [])]
    return rows.some((r) => favoritoSegueEmpresa(r, eid))
  }

  return (data ?? []).some((r) => favoritoSegueEmpresa(r, eid))
}

/** Remove favorito da empresa (ambos os formatos de coluna). */
export async function deletarFavoritoEmpresa(
  supabase: SupabaseClient,
  usuarioId: string,
  empresaId: string
) {
  const uid = String(usuarioId)
  const eid = String(empresaId)
  await Promise.all([
    supabase.from('favoritos').delete().eq('usuario_id', uid).eq('alvo_id', eid),
    supabase.from('favoritos').delete().eq('usuario_id', uid).eq('empresa_id', eid),
  ])
}

/** Contagem de seguidores únicos (deduplica legado + modelo `alvo_id`). */
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
  const eid = String(empresaId)

  const { data, error } = await supabase
    .from('favoritos')
    .select('usuario_id, empresa_id, alvo_id, alvo_tipo')
    .or(`empresa_id.eq.${eid},alvo_id.eq.${eid}`)

  if (error) {
    const [porAlvo, porEmpresa] = await Promise.all([
      supabase.from('favoritos').select('usuario_id, empresa_id, alvo_id, alvo_tipo').eq('alvo_id', eid),
      supabase.from('favoritos').select('usuario_id, empresa_id, alvo_id, alvo_tipo').eq('empresa_id', eid),
    ])
    const rows = [...(porAlvo.data ?? []), ...(porEmpresa.data ?? [])]
    const ids = new Set<string>()
    for (const row of rows) {
      if (!favoritoSegueEmpresa(row, eid)) continue
      const uid = row.usuario_id != null ? String(row.usuario_id) : ''
      if (uid) ids.add(uid)
    }
    return [...ids]
  }

  const ids = new Set<string>()
  for (const row of data ?? []) {
    if (!favoritoSegueEmpresa(row, eid)) continue
    const uid = row.usuario_id != null ? String(row.usuario_id) : ''
    if (uid) ids.add(uid)
  }
  return [...ids]
}
