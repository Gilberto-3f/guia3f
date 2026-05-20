/**
 * Conta com documentação conferida (selo verde no nome social).
 * @param {'profissional' | 'empresa' | string | null | undefined} role
 * @param {{ docs_verificado?: boolean | null, status?: string | null } | null | undefined} perfil
 */
export function contaVerificadaDocumentacao(role, perfil) {
  if (!perfil) return false
  const docs = Boolean(perfil.docs_verificado)
  const status = String(perfil.status ?? '').toLowerCase()
  if (role === 'profissional') {
    return docs && status === 'aprovado'
  }
  if (role === 'empresa') {
    return docs || status === 'ativo'
  }
  return false
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string[]} usuarioIds
 * @returns {Promise<Map<string, boolean>>}
 */
export async function fetchVerificadoPorUsuarioIds(supabase, usuarioIds) {
  /** @type {Map<string, boolean>} */
  const map = new Map()
  const unique = [...new Set((usuarioIds ?? []).map((x) => String(x ?? '').trim()).filter(Boolean))]
  if (unique.length === 0) return map

  const { data: users } = await supabase.from('usuarios').select('id, role').in('id', unique)
  const roleById = new Map((users ?? []).map((u) => [String(u.id), String(u.role ?? '')]))

  const profIds = unique.filter((id) => roleById.get(id) === 'profissional')
  const empIds = unique.filter((id) => roleById.get(id) === 'empresa')

  const [profRes, empRes] = await Promise.all([
    profIds.length
      ? supabase.from('profissionais').select('usuario_id, docs_verificado, status').in('usuario_id', profIds)
      : Promise.resolve({ data: [] }),
    empIds.length
      ? supabase.from('empresas').select('usuario_id, docs_verificado, status').in('usuario_id', empIds)
      : Promise.resolve({ data: [] }),
  ])

  for (const row of profRes.data ?? []) {
    const uid = row.usuario_id != null ? String(row.usuario_id) : ''
    if (uid) map.set(uid, contaVerificadaDocumentacao('profissional', row))
  }
  for (const row of empRes.data ?? []) {
    const uid = row.usuario_id != null ? String(row.usuario_id) : ''
    if (uid) map.set(uid, contaVerificadaDocumentacao('empresa', row))
  }

  return map
}
