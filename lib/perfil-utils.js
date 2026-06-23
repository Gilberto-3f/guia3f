/**
 * @typedef {{ usuario_id: string; empresa_id: string | null; nome: string; username: string; foto_url: string | null; tipo: string }} PerfilBuscaRow
 */

/**
 * Calcula um "peso" para o tipo de perfil.
 * Maior valor = maior prioridade.
 *
 * empresa > profissional > turista > outros
 *
 * @param {string | null | undefined} t
 * @returns {number}
 */
export function tipoRank(t) {
  const x = String(t ?? '').toLowerCase()
  if (x === 'empresa') return 3
  if (x === 'profissional') return 2
  if (x === 'turista') return 1
  return 0
}

/**
 * Remove duplicados por `usuario_id`, escolhendo sempre o melhor
 * registo para cada utilizador.
 *
 * Se for passado `preferTipoPorUsuarioId`, esse mapa é usado para
 * dar um bónus grande ao tipo preferido (caso exista).
 *
 * @param {PerfilBuscaRow[]} rows
 * @param {Map<string, string | null>} [preferTipoPorUsuarioId]
 * @returns {PerfilBuscaRow[]}
 */
export function dedupePerfisPorUsuario(rows, preferTipoPorUsuarioId) {
  /** @type {Map<string, PerfilBuscaRow>} */
  const best = new Map()

  for (const r of rows) {
    const uid = String(r.usuario_id ?? '')
    if (!uid) continue

    const cur = best.get(uid)
    if (!cur) {
      best.set(uid, r)
      continue
    }

    let rScore = tipoRank(r.tipo)
    let cScore = tipoRank(cur.tipo)

    if (preferTipoPorUsuarioId) {
      const pref = preferTipoPorUsuarioId.get(uid)
      if (pref != null && pref !== '') {
        const prefStr = String(pref)
        if (String(r.tipo) === prefStr) rScore += 100
        if (String(cur.tipo) === prefStr) cScore += 100
      }
    }

    if (rScore > cScore) {
      best.set(uid, r)
    } else if (rScore === cScore && String(r.username ?? '') < String(cur.username ?? '')) {
      best.set(uid, r)
    }
  }

  return [...best.values()]
}

/**
 * Gera o href correto para o perfil (empresa ou usuário comum).
 * Contas com `role`/`tipo` empresa devem ir sempre para `/empresa/{id}` quando `empresa_id` existir;
 * não usar `/perfil/{usuario_id}` para evitar a página “Use a página da empresa…”.
 *
 * @param {{ tipo?: string; role?: string; empresa_id?: string | null; usuario_id: string }} item
 * @returns {string}
 */
export function getPerfilHref(item) {
  const usuarioId = item.usuario_id != null ? String(item.usuario_id).trim() : ''
  const tipo = String(item.tipo ?? '').toLowerCase()
  const role = String(item.role ?? '').toLowerCase()
  const ehEmpresa = tipo === 'empresa' || role === 'empresa'
  const empresaId =
    item.empresa_id != null && String(item.empresa_id).trim() !== '' ? String(item.empresa_id).trim() : ''
  if (ehEmpresa && empresaId !== '') {
    return `/empresa/${empresaId}`
  }
  if (ehEmpresa && usuarioId !== '') {
    // Conta comercial sem `empresa_id` no objeto — evitar rota de perfil social incorreta.
    return '/guia'
  }
  if (usuarioId === '') return '/guia'
  return `/perfil/${usuarioId}`
}

/**
 * Busca perfis por lista de IDs usando a view perfis_para_busca.
 * Já devolve a lista deduplicada e ordenada usando `dedupePerfisPorUsuario`.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string[]} ids
 * @param {Map<string, string | null>} [preferTipoPorUsuarioId]
 * @returns {Promise<PerfilBuscaRow[]>}
 */
export async function buscarPerfisPorIds(supabase, ids, preferTipoPorUsuarioId) {
  if (!ids || ids.length === 0) return []

  const { data, error } = await supabase
    .from('perfis_para_busca')
    .select('usuario_id, empresa_id, username, nome, foto_url, tipo')
    .in('usuario_id', ids)

  if (error) {
    console.error('Erro ao buscar perfis:', error)
    return []
  }

  return dedupePerfisPorUsuario(/** @type {PerfilBuscaRow[]} */ (data ?? []), preferTipoPorUsuarioId)
}

/**
 * Busca perfis sociais (usuários) por IDs, sem envolver empresas/profissionais preview.
 * Regra:
 * - Username / nome / avatar vêm de `turistas` (principal) e podem cair em `profissionais` (fallback),
 *   mas NUNCA em `empresas`.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string[]} ids
 * @returns {Promise<{ usuario_id: string; username: string; nome: string; foto_url: string | null; origem: 'turistas' | 'profissionais' | 'fallback'; verificadoProfissional?: boolean }[]>}
 */
export async function buscarPerfisSociaisPorIds(supabase, ids) {
  const unique = [...new Set((ids ?? []).map((x) => String(x ?? '').trim()).filter(Boolean))]
  if (unique.length === 0) return []

  const [turRes, profRes, userRes] = await Promise.all([
    supabase.from('turistas').select('usuario_id, nome_completo, nome_usuario, foto_perfil_url, foto_url').in('usuario_id', unique),
    supabase
      .from('profissionais')
      .select('usuario_id, nome_completo, nome_usuario, foto_perfil_url, foto_url, docs_verificado, status')
      .in('usuario_id', unique),
    supabase.from('usuarios').select('id, email').in('id', unique),
  ])

  if (turRes.error) console.warn('[buscarPerfisSociaisPorIds] turistas:', turRes.error.message)
  if (profRes.error) console.warn('[buscarPerfisSociaisPorIds] profissionais:', profRes.error.message)
  if (userRes.error) console.warn('[buscarPerfisSociaisPorIds] usuarios:', userRes.error.message)

  /** @type {Map<string, { usuario_id: string; username: string; nome: string; foto_url: string | null; origem: 'turistas' | 'profissionais' }>} */
  const byId = new Map()

  const pickFoto = (row) => {
    if (!row || typeof row !== 'object') return null
    const a = row.foto_perfil_url != null && String(row.foto_perfil_url).trim() !== '' ? String(row.foto_perfil_url) : null
    const b = row.foto_url != null && String(row.foto_url).trim() !== '' ? String(row.foto_url) : null
    return a ?? b
  }

  for (const t of turRes.data ?? []) {
    const uid = t?.usuario_id != null ? String(t.usuario_id).trim() : ''
    if (!uid) continue
    const username = t?.nome_usuario != null ? String(t.nome_usuario).trim() : ''
    const nome = t?.nome_completo != null ? String(t.nome_completo).trim() : ''
    byId.set(uid, {
      usuario_id: uid,
      username: username || 'usuario',
      nome: nome || 'Usuário',
      foto_url: pickFoto(t),
      origem: 'turistas',
    })
  }

  for (const p of profRes.data ?? []) {
    const uid = p?.usuario_id != null ? String(p.usuario_id).trim() : ''
    if (!uid) continue
    if (byId.has(uid)) continue
    const username = p?.nome_usuario != null ? String(p.nome_usuario).trim() : ''
    const nome = p?.nome_completo != null ? String(p.nome_completo).trim() : ''
    byId.set(uid, {
      usuario_id: uid,
      username: username || 'usuario',
      nome: nome || 'Usuário',
      foto_url: pickFoto(p),
      origem: 'profissionais',
      verificadoProfissional:
        Boolean(p.docs_verificado) && String(p.status ?? '').toLowerCase() === 'aprovado',
    })
  }

  /** @type {Map<string, string>} */
  const emailById = new Map()
  for (const u of userRes.data ?? []) {
    const id = u?.id != null ? String(u.id).trim() : ''
    const email = u?.email != null ? String(u.email).trim() : ''
    if (id && email) emailById.set(id, email)
  }

  return unique.map((uid) => {
    const cur = byId.get(uid)
    if (cur) return cur
    const email = emailById.get(uid) ?? ''
    const base = email ? email.split('@')[0] : 'usuario'
    return { usuario_id: uid, username: base || 'usuario', nome: base || 'Usuário', foto_url: null, origem: 'fallback' }
  })
}

