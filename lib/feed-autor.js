import { podeVerConteudoEmpresaPreviewApp } from '@/lib/modoApresentacaoVisibilidade'

/** Supabase pode devolver embed 1:1 como objeto ou array com um elemento. */
function unwrapEmbed(v) {
  if (v == null) return null
  if (Array.isArray(v)) {
    const first = v[0]
    return first != null && typeof first === 'object' ? /** @type {Record<string, unknown>} */ (first) : null
  }
  if (typeof v === 'object') return /** @type {Record<string, unknown>} */ (v)
  return null
}

/** Borda gradiente dos stories (alinhar PostCard / barra). */
export const STORY_RING_GRADIENT =
  'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)'

/**
 * @param {{ foto_perfil_url?: unknown, foto_url?: unknown } | null | undefined} perfil
 * @returns {string | null}
 */
function pickFotoPerfilOuLegacy(perfil) {
  if (!perfil || typeof perfil !== 'object') return null
  if (perfil.foto_perfil_url != null) return String(perfil.foto_perfil_url)
  if (perfil.foto_url != null) return String(perfil.foto_url)
  return null
}

/**
 * Foto de perfil pela mesma regra da BottomBar (turistas / profissionais / empresas / admin).
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
    return pickFotoPerfilOuLegacy(perfil)
  }
  if (role === 'profissional') {
    const { data: perfil } = await supabase.from('profissionais').select('foto_perfil_url, foto_url').eq('usuario_id', uid).maybeSingle()
    return pickFotoPerfilOuLegacy(perfil)
  }
  if (role === 'admin') {
    const [profRes, turRes] = await Promise.all([
      supabase.from('profissionais').select('foto_perfil_url, foto_url').eq('usuario_id', uid).maybeSingle(),
      supabase.from('turistas').select('foto_perfil_url, foto_url').eq('usuario_id', uid).maybeSingle(),
    ])
    const fromProf = pickFotoPerfilOuLegacy(profRes.data)
    if (fromProf) return fromProf
    return pickFotoPerfilOuLegacy(turRes.data)
  }
  return null
}

const emptyRows = { data: [], error: null }

/**
 * Fotos de perfil atuais por `usuario_id` (mesma regra que {@link fetchFotoPerfilUsuario}), em poucas queries.
 * Útil quando `perfis_para_busca.foto_url` não reflete `foto_perfil_url`.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string[]} ids
 * @returns {Promise<Map<string, string | null>>}
 */
export async function fetchFotosPerfilPorUsuarioIds(supabase, ids) {
  /** @type {Map<string, string | null>} */
  const map = new Map()
  const unique = [...new Set((ids || []).map((x) => String(x ?? '').trim()).filter(Boolean))]
  if (unique.length === 0) return map

  const { data: users, error } = await supabase.from('usuarios').select('id, role').in('id', unique)
  if (error || !users) return map

  /** @type {string[]} */
  const turistaIds = []
  /** @type {string[]} */
  const profIds = []
  /** @type {string[]} */
  const empresaIds = []
  /** @type {string[]} */
  const adminIds = []

  for (const u of users) {
    const id = u.id != null ? String(u.id) : ''
    if (!id) continue
    const role = String(u.role ?? '')
    if (role === 'turista') turistaIds.push(id)
    else if (role === 'profissional') profIds.push(id)
    else if (role === 'empresa') empresaIds.push(id)
    else if (role === 'admin') adminIds.push(id)
  }

  const [turRes, profRes, empRes, adminProfRes, adminTurRes] = await Promise.all([
    turistaIds.length
      ? supabase.from('turistas').select('usuario_id, foto_perfil_url, foto_url').in('usuario_id', turistaIds)
      : Promise.resolve(emptyRows),
    profIds.length
      ? supabase.from('profissionais').select('usuario_id, foto_perfil_url, foto_url').in('usuario_id', profIds)
      : Promise.resolve(emptyRows),
    empresaIds.length
      ? supabase.from('empresas').select('usuario_id, foto_url').in('usuario_id', empresaIds)
      : Promise.resolve(emptyRows),
    adminIds.length
      ? supabase.from('profissionais').select('usuario_id, foto_perfil_url, foto_url').in('usuario_id', adminIds)
      : Promise.resolve(emptyRows),
    adminIds.length
      ? supabase.from('turistas').select('usuario_id, foto_perfil_url, foto_url').in('usuario_id', adminIds)
      : Promise.resolve(emptyRows),
  ])

  for (const row of /** @type {Record<string, unknown>[]} */ (turRes.data ?? [])) {
    const uid = row.usuario_id != null ? String(row.usuario_id) : ''
    if (uid) map.set(uid, pickFotoPerfilOuLegacy(row))
  }
  for (const row of /** @type {Record<string, unknown>[]} */ (profRes.data ?? [])) {
    const uid = row.usuario_id != null ? String(row.usuario_id) : ''
    if (uid) map.set(uid, pickFotoPerfilOuLegacy(row))
  }
  for (const row of /** @type {Record<string, unknown>[]} */ (empRes.data ?? [])) {
    const uid = row.usuario_id != null ? String(row.usuario_id) : ''
    if (uid) map.set(uid, row.foto_url != null ? String(row.foto_url) : null)
  }

  const profByAdmin = new Map()
  for (const row of /** @type {Record<string, unknown>[]} */ (adminProfRes.data ?? [])) {
    const uid = row.usuario_id != null ? String(row.usuario_id) : ''
    if (uid) profByAdmin.set(uid, row)
  }
  const turByAdmin = new Map()
  for (const row of /** @type {Record<string, unknown>[]} */ (adminTurRes.data ?? [])) {
    const uid = row.usuario_id != null ? String(row.usuario_id) : ''
    if (uid) turByAdmin.set(uid, row)
  }
  for (const uid of adminIds) {
    const fromProf = pickFotoPerfilOuLegacy(profByAdmin.get(uid))
    if (fromProf) {
      map.set(uid, fromProf)
      continue
    }
    map.set(uid, pickFotoPerfilOuLegacy(turByAdmin.get(uid)))
  }

  return map
}

/**
 * Handle (@nome_usuario) para a barra de stories — mesma ideia de {@link fetchFotoPerfilUsuario}:
 * lê `turistas` / `profissionais` diretamente (RLS/embed de `usuarios` pode omitir `nome_usuario`).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} uid
 * @returns {Promise<string | null>}
 */
export async function fetchNomeUsuarioParaStory(supabase, uid) {
  const { data: userData } = await supabase.from('usuarios').select('role').eq('id', uid).maybeSingle()
  const role = userData?.role ?? null
  if (role === 'empresa') return null
  if (role === 'turista') {
    const { data: perfil } = await supabase.from('turistas').select('nome_usuario').eq('usuario_id', uid).maybeSingle()
    const nu = perfil?.nome_usuario != null ? String(perfil.nome_usuario).trim() : ''
    return nu || null
  }
  if (role === 'profissional') {
    const { data: perfil } = await supabase.from('profissionais').select('nome_usuario').eq('usuario_id', uid).maybeSingle()
    const nu = perfil?.nome_usuario != null ? String(perfil.nome_usuario).trim() : ''
    return nu || null
  }
  if (role === 'admin') {
    const [profRes, turRes] = await Promise.all([
      supabase.from('profissionais').select('nome_usuario').eq('usuario_id', uid).maybeSingle(),
      supabase.from('turistas').select('nome_usuario').eq('usuario_id', uid).maybeSingle(),
    ])
    const nuP = profRes.data?.nome_usuario != null ? String(profRes.data.nome_usuario).trim() : ''
    if (nuP) return nuP
    const nuT = turRes.data?.nome_usuario != null ? String(turRes.data.nome_usuario).trim() : ''
    return nuT || null
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
      row.username ?? row.nome_usuario ?? (email ? email.split('@')[0] : 'usuario')
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

  const turista = unwrapEmbed(row.turistas)
  const profissional = unwrapEmbed(row.profissionais)
  const empresa = unwrapEmbed(row.empresas)

  /** Conta empresa na view pode ter também linha em turistas/profissionais; priorizar o embed `empresas`. */
  if (empresa) {
    const nome = String((empresa.nome_fantasia ?? email) || 'Empresa')
    const username = String(
      (typeof row.username === 'string' && row.username.trim() !== '' ? row.username.trim() : null) ??
        empresa.nome_usuario ??
        (email ? email.split('@')[0] : 'empresa')
    )
    const foto = empresa.foto_url != null ? String(empresa.foto_url) : null
    const empresaId = empresa.id != null ? String(empresa.id) : ''
    return { nome, username, foto_perfil_url: foto, usuario_id: usuarioId, empresa_id: empresaId, role: 'empresa' }
  }
  if (turista) {
    const nome = String((turista.nome_completo ?? email) || 'Usuário')
    const username = String(
      (typeof row.username === 'string' && row.username.trim() !== '' ? row.username.trim() : null) ??
        turista.nome_usuario ??
        (email ? email.split('@')[0] : 'usuario')
    )
    const foto = pickFotoPerfilOuLegacy(turista)
    return { nome, username, foto_perfil_url: foto, usuario_id: usuarioId, empresa_id: '', role: 'turista' }
  }
  if (profissional) {
    const nome = String((profissional.nome_completo ?? email) || 'Usuário')
    const username = String(
      (typeof row.username === 'string' && row.username.trim() !== '' ? row.username.trim() : null) ??
        profissional.nome_usuario ??
        (email ? email.split('@')[0] : 'usuario')
    )
    const foto = pickFotoPerfilOuLegacy(profissional)
    return { nome, username, foto_perfil_url: foto, usuario_id: usuarioId, empresa_id: '', role: 'profissional' }
  }

  return {
    nome: email ? email.split('@')[0] : 'Usuário',
    username: String(
      (typeof row.username === 'string' && row.username.trim() !== '' ? row.username.trim() : null) ??
        (email ? email.split('@')[0] : 'usuario')
    ),
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

/**
 * Quem não é o ADM demo com modo apresentação ativo não deve ver nome/@/foto da empresa demo no feed:
 * substitui autores ligados a `empresas.somente_modo_apresentacao` pelos dados sociais (turista/profissional).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Array<Record<string, unknown>>} posts
 * @param {string | null | undefined} viewerEmail
 * @param {boolean} modoAtivo
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function sanearAutoresPostsEmpresaPreview(supabase, posts, viewerEmail, modoAtivo) {
  if (podeVerConteudoEmpresaPreviewApp(viewerEmail, modoAtivo)) return posts
  if (!Array.isArray(posts) || posts.length === 0) return posts

  const empresaIds = [
    ...new Set(
      posts
        .map((p) => {
          const a = p?.autor && typeof p.autor === 'object' ? /** @type {Record<string, unknown>} */ (p.autor) : null
          if (!a) return ''
          if (String(a.role ?? '').toLowerCase() !== 'empresa') return ''
          const eid = a.empresa_id != null ? String(a.empresa_id).trim() : ''
          return eid
        })
        .filter(Boolean)
    ),
  ]
  if (empresaIds.length === 0) return posts

  const { data: emps, error } = await supabase
    .from('empresas')
    .select('id, usuario_id, somente_modo_apresentacao')
    .in('id', empresaIds)
  if (error || !emps?.length) return posts

  const previewEmpresaIdSet = new Set(
    emps
      .filter((e) => e?.somente_modo_apresentacao === true && e?.id != null)
      .map((e) => String(/** @type {{ id: unknown }} */ (e).id))
  )
  if (previewEmpresaIdSet.size === 0) return posts

  const uidsToFix = [
    ...new Set(
      posts
        .map((p) => {
          const a = p?.autor && typeof p.autor === 'object' ? /** @type {Record<string, unknown>} */ (p.autor) : null
          const eid = a?.empresa_id != null ? String(a.empresa_id) : ''
          if (!previewEmpresaIdSet.has(eid)) return ''
          return a?.usuario_id != null ? String(a.usuario_id) : ''
        })
        .filter(Boolean)
    ),
  ]
  if (uidsToFix.length === 0) return posts

  const [{ data: turRows }, { data: profRows }] = await Promise.all([
    supabase.from('turistas').select('usuario_id, nome_completo, nome_usuario, foto_perfil_url, foto_url').in('usuario_id', uidsToFix),
    supabase.from('profissionais').select('usuario_id, nome_completo, nome_usuario, foto_perfil_url, foto_url').in('usuario_id', uidsToFix),
  ])

  /** @type {Map<string, Record<string, unknown>>} */
  const turBy = new Map()
  for (const t of turRows ?? []) {
    const uid = t?.usuario_id != null ? String(t.usuario_id) : ''
    if (uid) turBy.set(uid, /** @type {Record<string, unknown>} */ (t))
  }
  /** @type {Map<string, Record<string, unknown>>} */
  const profBy = new Map()
  for (const pr of profRows ?? []) {
    const uid = pr?.usuario_id != null ? String(pr.usuario_id) : ''
    if (uid) profBy.set(uid, /** @type {Record<string, unknown>} */ (pr))
  }

  return posts.map((p) => {
    const autorRaw = p?.autor && typeof p.autor === 'object' ? /** @type {Record<string, unknown>} */ (p.autor) : null
    if (!autorRaw) return p
    const eid = autorRaw.empresa_id != null ? String(autorRaw.empresa_id) : ''
    if (!previewEmpresaIdSet.has(eid)) return p
    const uid = autorRaw.usuario_id != null ? String(autorRaw.usuario_id) : ''
    const t = uid ? turBy.get(uid) : undefined
    const pr = uid ? profBy.get(uid) : undefined
    const row = t || pr
    if (!row) return p
    const nomeCompleto = row.nome_completo != null ? String(row.nome_completo).trim() : ''
    const nomeUser = row.nome_usuario != null ? String(row.nome_usuario).trim() : ''
    const nome = nomeCompleto !== '' ? nomeCompleto : String(autorRaw.nome ?? 'Usuário')
    const username = nomeUser !== '' ? nomeUser : String(autorRaw.username ?? 'usuario')
    const foto = pickFotoPerfilOuLegacy(row)
    return {
      ...p,
      autor: {
        ...autorRaw,
        nome,
        username,
        foto_perfil_url: foto ?? autorRaw.foto_perfil_url,
        empresa_id: '',
        role: t ? 'turista' : 'profissional',
      },
    }
  })
}
