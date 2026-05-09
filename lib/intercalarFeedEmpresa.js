import { fetchPatrocinioAutorIds } from '@/lib/feedFiltroSeguidos'

/**
 * IDs de autores (usuario_id) elegíveis para slots promocionais no feed:
 * patrocínio ativo, empresa com `is_publicidade`, ou anúncio home ativo no período.
 * Exclui o próprio usuário e quem já é seguido.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ seguidosSet: Set<string>, meuId: string | null | undefined }} opts
 * @returns {Promise<string[]>}
 */
export async function fetchEmpresaFeedPromoAutorIds(supabase, { seguidosSet, meuId }) {
  const patrocinados = await fetchPatrocinioAutorIds(supabase)

  const { data: empPub } = await supabase.from('empresas').select('usuario_id').eq('is_publicidade', true)

  const fromFlag = [...new Set((empPub ?? []).map((r) => String(r.usuario_id)).filter(Boolean))]

  const hoje = new Date().toISOString().slice(0, 10)
  const { data: anuncRows } = await supabase
    .from('anuncios')
    .select('empresa_id')
    .eq('tipo', 'home')
    .eq('status', 'ativo')
    .lte('periodo_inicio', hoje)
    .gte('periodo_fim', hoje)

  const empIds = [...new Set((anuncRows ?? []).map((r) => r.empresa_id).filter(Boolean))]
  let fromAnuncio = []
  if (empIds.length > 0) {
    const { data: emps } = await supabase.from('empresas').select('usuario_id').in('id', empIds)
    fromAnuncio = [...new Set((emps ?? []).map((e) => String(e.usuario_id)).filter(Boolean))]
  }

  const merged = [...new Set([...patrocinados, ...fromFlag, ...fromAnuncio])].filter(Boolean)
  const meu = meuId != null ? String(meuId) : ''
  return merged.filter((id) => id && id !== meu && !seguidosSet.has(id))
}

/**
 * Intercala 1 post promocional (empresa não seguida) a cada `intervalo` posts orgânicos.
 * Evita dois promovidos seguidos (rotação por autor).
 *
 * @template T
 * @param {T[]} organicPosts posts só de seguidos + eu; mais recentes primeiro
 * @param {T[]} promoPosts posts de empresas promocionáveis; mais recentes primeiro
 * @param {(row: T) => string} getAutorId
 * @param {number} [intervalo=20]
 * @returns {T[]}
 */
export function intercalarPostsEmpresa(organicPosts, promoPosts, getAutorId, intervalo = 20) {
  const o = [...organicPosts].sort(
    (a, b) =>
      new Date(/** @type {{ created_at?: string }} */ (b).created_at ?? 0).getTime() -
      new Date(/** @type {{ created_at?: string }} */ (a).created_at ?? 0).getTime()
  )

  /** @type {Map<string, T[]>} */
  const byAuthor = new Map()
  for (const row of promoPosts) {
    const aid = getAutorId(row)
    if (!aid) continue
    if (!byAuthor.has(aid)) byAuthor.set(aid, [])
    byAuthor.get(aid).push(row)
  }
  const authors = [...byAuthor.keys()]
  let authorRot = 0
  let lastPromoAuthor = /** @type {string | null} */ (null)

  const takeNextPromo = () => {
    if (authors.length === 0) return null
    let tries = 0
    while (tries < authors.length * 3) {
      const aid = authors[authorRot % authors.length]
      authorRot++
      tries++
      const queue = byAuthor.get(aid)
      if (!queue || queue.length === 0) continue
      if (authors.length > 1 && aid === lastPromoAuthor) continue
      const post = queue.shift()
      lastPromoAuthor = aid
      return post
    }
    return null
  }

  /** @type {T[]} */
  const out = []
  let streakOrg = 0
  let i = 0

  while (i < o.length || authors.some((a) => (byAuthor.get(a) ?? []).length > 0)) {
    if (streakOrg >= intervalo) {
      const promoPost = takeNextPromo()
      if (promoPost) {
        out.push(promoPost)
        streakOrg = 0
        continue
      }
    }
    if (i < o.length) {
      out.push(o[i])
      i++
      streakOrg++
    } else {
      const promoPost = takeNextPromo()
      if (promoPost) {
        out.push(promoPost)
        streakOrg = 0
      } else break
    }
  }

  return out
}

/**
 * Ordem de autores na barra de stories: a cada `intervalo` autores orgânicos, 1 empresa promovida.
 *
 * @param {string[]} organicAuthorIds orden preferencial (ex.: mais recente primeiro)
 * @param {string[]} promoAuthorIds empresas não seguidas com story
 * @param {number} [intervalo=20]
 * @param {number} [maxLen=12]
 * @returns {string[]}
 */
export function intercalarStoryAutores(organicAuthorIds, promoAuthorIds, intervalo = 20, maxLen = 12) {
  const organic = [...new Set(organicAuthorIds.filter(Boolean))]
  const promo = [...new Set(promoAuthorIds.filter(Boolean))].filter((id) => !organic.includes(id))
  /** @type {string[]} */
  const out = []
  let oi = 0
  let streak = 0
  let promoCursor = 0
  let lastPromo = /** @type {string | null} */ (null)

  while (out.length < maxLen) {
    if (streak >= intervalo && promo.length > 0) {
      let inserted = false
      for (let t = 0; t < promo.length; t++) {
        const cand = promo[promoCursor % promo.length]
        promoCursor++
        if (promo.length > 1 && cand === lastPromo) continue
        if (out.includes(cand)) continue
        out.push(cand)
        lastPromo = cand
        streak = 0
        inserted = true
        break
      }
      if (!inserted) streak = 0
      continue
    }
    if (oi < organic.length) {
      const id = organic[oi++]
      if (!out.includes(id)) out.push(id)
      streak++
    } else if (promo.length > 0) {
      let inserted = false
      for (let t = 0; t < promo.length; t++) {
        const cand = promo[promoCursor % promo.length]
        promoCursor++
        if (promo.length > 1 && cand === lastPromo) continue
        if (out.includes(cand)) continue
        out.push(cand)
        lastPromo = cand
        inserted = true
        break
      }
      if (!inserted) break
    } else break
  }

  return out
}
