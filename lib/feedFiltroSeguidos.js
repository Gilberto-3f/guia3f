/**
 * `usuario_id` das empresas com anúncio ativo (regra de datas + status).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<string[]>}
 */
export async function fetchPatrocinioAutorIds(supabase) {
  const hoje = new Date().toISOString().slice(0, 10)
  const { data: pubs, error } = await supabase
    .from('anuncios')
    .select('empresa_id')
    .eq('status', 'ativo')
    .lte('periodo_inicio', hoje)
    .gte('periodo_fim', hoje)

  if (error || !pubs?.length) return []

  const empIds = [...new Set(pubs.map((r) => r.empresa_id).filter(Boolean))]
  const { data: emps } = await supabase.from('empresas').select('usuario_id').in('id', empIds)
  return [...new Set((emps ?? []).map((e) => String(e.usuario_id)).filter(Boolean))]
}

/** @param {string | undefined} tipo */
export function isTipoVideoPost(tipo) {
  return String(tipo ?? '').toLowerCase() === 'video'
}

/** Post automático de «novo profissional verificado» — não exibir no feed. */
export function isTipoVerificacaoProfissionalPost(tipo) {
  return String(tipo ?? '').toLowerCase() === 'verificacao_profissional'
}

/** @param {string | undefined} tipo */
export function isPostOcultoDoFeed(tipo) {
  return isTipoVideoPost(tipo) || isTipoVerificacaoProfissionalPost(tipo)
}

/**
 * Post no feed: conteúdo social de anfitrião (autor_tipo ≠ empresa) só para seguidores;
 * conteúdo publicado como empresa segue a regra global do guia.
 * @param {{ autor_id?: unknown, autor_tipo?: unknown }} row
 * @param {{ meuId?: string | null, seguidos?: string[], gestoresAnfitriao?: Set<string> | string[] }} ctx
 */
export function postRawVisivelNoFeed(row, ctx = {}) {
  const autorId = String(row?.autor_id ?? '').trim()
  if (!autorId) return false
  const autorTipo = String(row?.autor_tipo ?? '').toLowerCase()
  if (autorTipo === 'empresa') return true

  const gestores = ctx.gestoresAnfitriao
  const gestorSet =
    gestores instanceof Set
      ? gestores
      : new Set((gestores ?? []).map((id) => String(id).trim()).filter(Boolean))
  if (!gestorSet.has(autorId)) return true

  const meuId = ctx.meuId != null ? String(ctx.meuId).trim() : ''
  if (meuId && autorId === meuId) return true

  const seguidos = (ctx.seguidos ?? []).map((id) => String(id).trim()).filter(Boolean)
  return seguidos.includes(autorId)
}
