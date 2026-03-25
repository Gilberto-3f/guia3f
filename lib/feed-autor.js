/**
 * Monta nome de exibição a partir do embed `usuarios` do Supabase.
 * @param {unknown} u
 */
export function pickAutorDisplay(u) {
  if (!u || typeof u !== 'object') {
    return { nome: 'Usuário', username: 'usuario', foto_perfil_url: null, usuario_id: '', empresa_id: '', role: 'user' }
  }
  const row = /** @type {Record<string, unknown>} */ (u)
  const email = typeof row.email === 'string' ? row.email : ''
  const usuarioId = row.id != null ? String(row.id) : ''
  const roleCol = typeof row.role === 'string' ? row.role : ''

  const tur = row.turistas
  const prof = row.profissionais
  const emps = row.empresas

  const turista = tur && typeof tur === 'object' && !Array.isArray(tur) ? /** @type {Record<string, unknown>} */ (tur) : null
  const profissional =
    prof && typeof prof === 'object' && !Array.isArray(prof) ? /** @type {Record<string, unknown>} */ (prof) : null

  let empresa = null
  if (emps && Array.isArray(emps) && emps[0] && typeof emps[0] === 'object') {
    empresa = /** @type {Record<string, unknown>} */ (emps[0])
  } else if (emps && typeof emps === 'object' && !Array.isArray(emps)) {
    empresa = /** @type {Record<string, unknown>} */ (emps)
  }

  if (turista) {
    const nome = String((turista.nome_completo ?? email) || 'Usuário')
    const username = String(turista.nome_usuario ?? (email ? email.split('@')[0] : 'usuario'))
    const foto = turista.foto_perfil_url != null ? String(turista.foto_perfil_url) : null
    return { nome, username, foto_perfil_url: foto, usuario_id: usuarioId, empresa_id: '', role: 'turista' }
  }
  if (profissional) {
    const nome = String((profissional.nome_completo ?? email) || 'Usuário')
    const username = String(profissional.nome_usuario ?? (email ? email.split('@')[0] : 'usuario'))
    const foto = profissional.foto_perfil_url != null ? String(profissional.foto_perfil_url) : null
    return { nome, username, foto_perfil_url: foto, usuario_id: usuarioId, empresa_id: '', role: 'profissional' }
  }
  if (empresa) {
    const nome = String((empresa.nome_fantasia ?? email) || 'Empresa')
    const username = String(empresa.nome_usuario ?? (email ? email.split('@')[0] : 'empresa'))
    const foto = empresa.foto_url != null ? String(empresa.foto_url) : null
    const empresaId = empresa.id != null ? String(empresa.id) : ''
    return { nome, username, foto_perfil_url: foto, usuario_id: usuarioId, empresa_id: empresaId, role: 'empresa' }
  }

  return {
    nome: email ? email.split('@')[0] : 'Usuário',
    username: email ? email.split('@')[0] : 'usuario',
    foto_perfil_url: null,
    usuario_id: usuarioId,
    empresa_id: '',
    role: roleCol || 'user',
  }
}

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
export function visualizadoPorEmails(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map((x) => String(x))
  try {
    const j = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (Array.isArray(j)) return j.map((x) => String(x))
  } catch {
    /* ignore */
  }
  return []
}
