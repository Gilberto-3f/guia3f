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
