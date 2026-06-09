import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * `usuario_id` de todas as empresas públicas do guia (conteúdo visível no feed/stories para todos).
 * Exclui páginas só de modo apresentação, salvo quando `incluirModoApresentacao` é true.
 */
export async function fetchUsuarioIdsTodasEmpresasGuia(
  supabase: SupabaseClient,
  opts?: { incluirModoApresentacao?: boolean },
): Promise<string[]> {
  let q = supabase.from('empresas').select('usuario_id')
  if (!opts?.incluirModoApresentacao) {
    q = q.eq('somente_modo_apresentacao', false)
  }
  const { data, error } = await q
  if (error || !data?.length) return []
  return [...new Set(data.map((e) => String((e as { usuario_id: unknown }).usuario_id)).filter(Boolean))]
}

/**
 * @deprecated Mantido para Comissões (estrela de favoritos em ofertas). Não usar no feed.
 */
export async function fetchUsuarioIdsEmpresasFavoritas(
  supabase: SupabaseClient,
  meuId: string | null,
): Promise<string[]> {
  if (!meuId) return []
  const { data: favs, error } = await supabase
    .from('favoritos')
    .select('alvo_id')
    .eq('usuario_id', meuId)
    .eq('alvo_tipo', 'empresa')
  if (error || !favs?.length) return []
  const empIds = [...new Set(favs.map((f) => String((f as { alvo_id: unknown }).alvo_id)).filter(Boolean))]
  if (empIds.length === 0) return []
  const { data: emps, error: errE } = await supabase.from('empresas').select('usuario_id').in('id', empIds)
  if (errE || !emps?.length) return []
  return [...new Set(emps.map((e) => String((e as { usuario_id: unknown }).usuario_id)).filter(Boolean))]
}

/**
 * IDs de autores cujas interações aparecem na aba Amigos de `/atividades`:
 * perfis seguidos em `redecontatos` + gestores de todas as empresas do guia.
 */
export async function fetchAutorIdsSeguidosAmigos(
  supabase: SupabaseClient,
  meuId: string | null,
  opts?: { incluirModoApresentacao?: boolean },
): Promise<string[]> {
  if (!meuId) return []
  const [{ data: segRows, error: errRede }, autoresEmpresas] = await Promise.all([
    supabase.from('redecontatos').select('seguido_id').eq('seguidor_id', meuId),
    fetchUsuarioIdsTodasEmpresasGuia(supabase, opts),
  ])
  if (errRede && process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.error('[Atividades] redecontatos (seguindo):', errRede)
  }
  const seguidosRede = (segRows ?? [])
    .map((r) => String((r as { seguido_id: string }).seguido_id))
    .filter(Boolean)
  return [...new Set([...seguidosRede, ...autoresEmpresas])].filter(Boolean)
}
