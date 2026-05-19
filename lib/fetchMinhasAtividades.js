import { buscarPerfisSociaisPorIds } from '@/lib/perfil-utils'

/**
 * @param {unknown} p
 */
function postEmb(p) {
  if (p == null) return null
  const raw = Array.isArray(p) ? p[0] : p
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const pr = /** @type {Record<string, unknown>} */ (raw)
  return {
    deleted_at: pr.deleted_at,
    texto: pr.texto,
    conteudo_url: pr.conteudo_url,
    foto_url: pr.foto_url,
    tipo: pr.tipo,
    autor_id: pr.autor_id,
  }
}

/**
 * @param {{ texto?: unknown, conteudo_url?: unknown, foto_url?: unknown, tipo?: unknown } | null} pr
 */
function postInteracaoEhFoto(pr) {
  if (!pr) return false
  const t = String(pr.tipo ?? 'texto').toLowerCase()
  if (t === 'foto' || t === 'misto') return true
  const url = pr.conteudo_url || pr.foto_url
  const hasUrl = url != null && String(url).trim() !== ''
  const hasText = pr.texto != null && String(pr.texto).trim() !== ''
  return hasUrl && !hasText
}

/** @type {Map<string, { linhas: unknown[], ts: number }>} */
const cache = new Map()
const CACHE_MS = 90_000

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} usuarioId
 * @param {{ skipCache?: boolean }} [opts]
 */
export async function fetchMinhasAtividadesLinhas(supabase, usuarioId, opts = {}) {
  const hit = cache.get(usuarioId)
  if (!opts.skipCache && hit && Date.now() - hit.ts < CACHE_MS) {
    return hit.linhas
  }

  const [cRes, ccRes, kRes] = await Promise.all([
    supabase
      .from('curtidas')
      .select('id, created_at, post_id, posts(id, texto, conteudo_url, foto_url, deleted_at)')
      .eq('usuario_id', usuarioId)
      .not('post_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('curtidas')
      .select(
        'id, created_at, comentario_id, comentarios(id, texto, post_id, deleted_at, posts(id, texto, conteudo_url, foto_url, deleted_at))'
      )
      .eq('usuario_id', usuarioId)
      .is('post_id', null)
      .not('comentario_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('comentarios')
      .select('id, texto, created_at, post_id, posts(id, texto, conteudo_url, foto_url, deleted_at, tipo, autor_id)')
      .eq('autor_id', usuarioId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  /** @type {Record<string, unknown>[]} */
  const acc = []

  for (const row of cRes.data ?? []) {
    const pr = postEmb(row.posts)
    if (!pr || pr.deleted_at != null) continue
    const url = pr.conteudo_url || pr.foto_url
    acc.push({
      id: `c-${row.id}`,
      ts: String(row.created_at ?? ''),
      postId: String(row.post_id ?? ''),
      kind: 'curtida',
      comentarioId: null,
      thumb: url != null ? String(url) : null,
      texto: pr.texto != null ? String(pr.texto) : null,
    })
  }

  for (const row of ccRes.data ?? []) {
    const cid = row.comentario_id != null ? String(row.comentario_id) : ''
    const rawCom = row.comentarios
    const com = Array.isArray(rawCom) ? rawCom[0] : rawCom
    if (!com || typeof com !== 'object' || Array.isArray(com)) continue
    const cr = /** @type {Record<string, unknown>} */ (com)
    if (cr.deleted_at != null) continue
    const postIdCom = cr.post_id != null ? String(cr.post_id) : ''
    if (!postIdCom) continue
    const pr = postEmb(cr.posts)
    if (!pr || pr.deleted_at != null) continue
    const url = pr.conteudo_url || pr.foto_url
    acc.push({
      id: `cc-${row.id}`,
      ts: String(row.created_at ?? ''),
      postId: postIdCom,
      kind: 'curtida',
      comentarioId: cid || null,
      thumb: url != null ? String(url) : null,
      texto: pr.texto != null ? String(pr.texto) : null,
      textoComentario: cr.texto != null ? String(cr.texto) : null,
    })
  }

  const comentarioRows = /** @type {Record<string, unknown>[]} */ (kRes.data ?? [])
  for (const row of comentarioRows) {
    const pr = postEmb(row.posts)
    if (!pr || pr.deleted_at != null) continue
    const url = pr.conteudo_url || pr.foto_url
    const autorPostId = pr.autor_id != null ? String(pr.autor_id) : ''
    acc.push({
      id: `k-${row.id}`,
      ts: String(row.created_at ?? ''),
      postId: String(row.post_id ?? ''),
      kind: 'comentario',
      comentarioId: String(row.id),
      thumb: url != null ? String(url) : null,
      texto: pr.texto != null ? String(pr.texto) : null,
      textoComentario: row.texto != null ? String(row.texto) : null,
      postAutorUsuarioId: autorPostId || null,
      postAutorUsername: null,
      postAutorEmpresaId: null,
      postAutorTipo: null,
      postEhFoto: postInteracaoEhFoto(pr),
      _pendentePerfil: Boolean(autorPostId),
    })
  }

  acc.sort((a, b) => new Date(String(b.ts)).getTime() - new Date(String(a.ts)).getTime())
  const linhas = acc.slice(0, 50)
  cache.set(usuarioId, { linhas, ts: Date.now() })
  return linhas
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Record<string, unknown>[]} linhas
 */
export async function enriquecerMinhasAtividadesPerfis(supabase, linhas) {
  const autorIds = [
    ...new Set(
      linhas
        .filter((L) => L.kind === 'comentario' && L.postAutorUsuarioId)
        .map((L) => String(L.postAutorUsuarioId))
    ),
  ]
  if (autorIds.length === 0) return linhas

  const perfis = await buscarPerfisSociaisPorIds(supabase, autorIds)
  const map = new Map(perfis.map((p) => [String(p.usuario_id), p]))

  return linhas.map((L) => {
    if (L.kind !== 'comentario' || !L.postAutorUsuarioId) return L
    const perfil = map.get(String(L.postAutorUsuarioId))
    if (!perfil) return { ...L, postAutorUsername: 'usuario', _pendentePerfil: false }
    return {
      ...L,
      postAutorUsername: perfil.username || 'usuario',
      postAutorEmpresaId: null,
      postAutorTipo: perfil.origem === 'profissionais' ? 'profissional' : 'turista',
      _pendentePerfil: false,
    }
  })
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string | null | undefined} usuarioId
 */
export function prefetchMinhasAtividades(supabase, usuarioId) {
  if (!usuarioId) return
  void fetchMinhasAtividadesLinhas(supabase, usuarioId).catch(() => {})
}
