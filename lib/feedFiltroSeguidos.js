/**
 * `usuario_id` das empresas com campanha ativa em publicacoes_publicidade (regra de datas + ativo).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<string[]>}
 */
export async function fetchPatrocinioAutorIds(supabase) {
  const now = new Date().toISOString()
  const { data: pubs, error } = await supabase
    .from('publicacoes_publicidade')
    .select('empresa_id')
    .eq('ativo', true)
    .lte('data_inicio', now)
    .gte('data_fim', now)

  if (error || !pubs?.length) return []

  const empIds = [...new Set(pubs.map((r) => r.empresa_id).filter(Boolean))]
  const { data: emps } = await supabase.from('empresas').select('usuario_id').in('id', empIds)
  return [...new Set((emps ?? []).map((e) => String(e.usuario_id)).filter(Boolean))]
}

/** @param {string | undefined} tipo */
export function isTipoVideoPost(tipo) {
  return String(tipo ?? '').toLowerCase() === 'video'
}
