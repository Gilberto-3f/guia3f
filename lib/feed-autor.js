/** Borda gradiente dos stories (alinhar PostCard / barra). */
export const STORY_RING_GRADIENT =
  'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)'

/**
 * Foto de perfil pela mesma regra da BottomBar (turistas / profissionais / empresas).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} uid
 * @returns {Promise<string | null>}
 */
export async function fetchFotoPerfilUsuario(supabase, uid) {
  const { data: userData } = await supabase.from('usuarios').select('role').eq('id', uid).maybeSingle()
  const role = userData?.role ?? null
  if (role === 'empresa') {
    const { data: empresa } = await supabase.from('empresas').select('foto_url').eq('usuario_id', uid).maybeSingle()
    return empresa?.foto_url != null ? String(empresa.foto_url) : null
  }
  if (role === 'turista') {
    const { data: perfil } = await supabase.from('turistas').select('foto_perfil_url, foto_url').eq('usuario_id', uid).maybeSingle()
    if (perfil?.foto_perfil_url != null) return String(perfil.foto_perfil_url)
    if (perfil?.foto_url != null) return String(perfil.foto_url)
    return null
  }
  if (role === 'profissional') {
    const { data: perfil } = await supabase.from('profissionais').select('foto_perfil_url, foto_url').eq('usuario_id', uid).maybeSingle()
    if (perfil?.foto_perfil_url != null) return String(perfil.foto_perfil_url)
    if (perfil?.foto_url != null) return String(perfil.foto_url)
    return null
  }
  return null
}

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

  // View `posts_com_autores`: JSON já achatado (sem embed turistas/profissionais/empresas)
  const hasNestedPerfil = row.turistas || row.profissionais || row.empresas
  const nomePlano = row.nome ?? row.nome_completo ?? row.nome_fantasia
  const temPerfilPlano =
    !hasNestedPerfil &&
    (nomePlano != null ||
      row.nome_usuario != null ||
      row.username != null ||
      row.foto_perfil_url != null ||
      row.foto_url != null)
  if (temPerfilPlano) {
    const nome = String(nomePlano || (email ? email.split('@')[0] : 'Usuário'))
    const username = String(
      row.nome_usuario ?? row.username ?? (email ? email.split('@')[0] : 'usuario')
    )
    const foto =
      row.foto_perfil_url != null
        ? String(row.foto_perfil_url)
        : row.foto_url != null
          ? String(row.foto_url)
          : null
    const empresaId = row.empresa_id != null ? String(row.empresa_id) : ''
    return {
      nome,
      username,
      foto_perfil_url: foto,
      usuario_id: usuarioId,
      empresa_id: empresaId,
      role: roleCol || 'user',
    }
  }

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

/**
 * @param {unknown} visualizado_por
 * @param {string | null | undefined} email
 */
export function emailVisualizouStory(visualizado_por, email) {
  if (!email) return false
  return visualizadoPorEmails(visualizado_por).includes(email)
}
