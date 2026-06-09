import type { SupabaseClient } from '@supabase/supabase-js'

type EmpresasGuiaOpts = {
  /** Inclui páginas só de modo apresentação (preview ADM). */
  incluirModoApresentacao?: boolean
  /** Colunas do select Supabase (padrão: `usuario_id`). */
  select?: string
}

/**
 * Empresas elegíveis no guia: verificadas pelo ADM e com página pública.
 * Mesmo critério base do guia turístico (`status = aprovado` + `docs_verificado`).
 */
function queryEmpresasGuiaAprovadas(
  supabase: SupabaseClient,
  opts?: EmpresasGuiaOpts,
) {
  let q = supabase
    .from('empresas')
    .select(opts?.select ?? 'usuario_id')
    .eq('status', 'aprovado')
    .eq('docs_verificado', true)

  if (!opts?.incluirModoApresentacao) {
    q = q.eq('somente_modo_apresentacao', false)
  }

  return q
}

/**
 * `usuario_id` das empresas do guia cujo conteúdo entra no feed/stories/atividades para todos.
 */
export async function fetchUsuarioIdsTodasEmpresasGuia(
  supabase: SupabaseClient,
  opts?: { incluirModoApresentacao?: boolean },
): Promise<string[]> {
  if (opts?.incluirModoApresentacao) {
    const [aprovadasRes, previewRes] = await Promise.all([
      queryEmpresasGuiaAprovadas(supabase, { incluirModoApresentacao: false }),
      supabase.from('empresas').select('usuario_id').eq('somente_modo_apresentacao', true),
    ])
    const ids = [
      ...(aprovadasRes.data ?? []),
      ...(previewRes.data ?? []),
    ].map((e) => String((e as { usuario_id: unknown }).usuario_id)).filter(Boolean)
    return [...new Set(ids)]
  }

  const { data, error } = await queryEmpresasGuiaAprovadas(supabase)
  if (error || !data?.length) return []
  return [...new Set(data.map((e) => String((e as { usuario_id: unknown }).usuario_id)).filter(Boolean))]
}

/**
 * Linhas de empresas do guia (ex.: StoriesBar), opcionalmente filtradas por `usuario_id`.
 */
export async function fetchEmpresasGuiaRows<T extends Record<string, unknown> = { usuario_id: string }>(
  supabase: SupabaseClient,
  opts?: EmpresasGuiaOpts & { usuarioIds?: string[] },
): Promise<T[]> {
  const select = opts?.select ?? 'usuario_id'
  const ids = (opts?.usuarioIds ?? []).map((id) => String(id).trim()).filter(Boolean)

  if (opts?.incluirModoApresentacao) {
    const aprovadasQ = queryEmpresasGuiaAprovadas(supabase, { select, incluirModoApresentacao: false })
    const previewQ = supabase.from('empresas').select(select).eq('somente_modo_apresentacao', true)
    const [aprovadasRes, previewRes] = await Promise.all([
      ids.length > 0 ? aprovadasQ.in('usuario_id', ids) : aprovadasQ,
      ids.length > 0 ? previewQ.in('usuario_id', ids) : previewQ,
    ])
    const merged = [...(aprovadasRes.data ?? []), ...(previewRes.data ?? [])] as T[]
    const seen = new Set<string>()
    return merged.filter((row) => {
      const uid = String((row as { usuario_id?: unknown }).usuario_id ?? '')
      if (!uid || seen.has(uid)) return false
      seen.add(uid)
      return true
    })
  }

  let q = queryEmpresasGuiaAprovadas(supabase, { select })
  if (ids.length > 0) {
    q = q.in('usuario_id', ids)
  }
  const { data, error } = await q
  if (error || !data?.length) return []
  return data as T[]
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
 * perfis seguidos em `redecontatos` + gestores de empresas aprovadas no guia.
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
