/** @typedef {{ id: string, tipo: string | null, texto: string | null, conteudo_url: string | null, foto_url: string | null, post_original_id: string | null, avaliacao_meta: unknown, autor_id: string }} PostMeta */

/**
 * Repost de story: visível enquanto o repost estiver ativo no carrossel (mesmo prazo de expira_em).
 * @param {{ tipo?: string | null, alvo_id?: string | null, dados_extras?: unknown } | null | undefined} row
 * @param {number} [agoraMs]
 */
export function atividadeRepostStoryVisivel(row, agoraMs = Date.now()) {
  if (!row || String(row.tipo ?? '') !== 'repostou_story') return true

  const ex =
    row.dados_extras && typeof row.dados_extras === 'object' && !Array.isArray(row.dados_extras)
      ? /** @type {Record<string, unknown>} */ (row.dados_extras)
      : null

  const expiraRaw = ex?.expira_em
  if (typeof expiraRaw === 'string' && expiraRaw.trim() !== '') {
    const expiraMs = Date.parse(expiraRaw)
    if (Number.isFinite(expiraMs) && expiraMs <= agoraMs) return false
  }

  return true
}

/**
 * @param {{ tipo?: string | null, alvo_id?: string | null, dados_extras?: unknown } | null | undefined} row
 * @returns {string | null}
 */
export function storyIdDeAtividadeCurtiu(row) {
  if (!row || String(row.tipo ?? '') !== 'curtiu_story') return null
  const ex =
    row.dados_extras && typeof row.dados_extras === 'object' && !Array.isArray(row.dados_extras)
      ? /** @type {Record<string, unknown>} */ (row.dados_extras)
      : null
  const fromExtras = ex?.story_id != null ? String(ex.story_id).trim() : ''
  if (fromExtras) return fromExtras
  const fromAlvo = row.alvo_id != null ? String(row.alvo_id).trim() : ''
  return fromAlvo || null
}

/**
 * @param {Array<{ tipo?: string | null, alvo_id?: string | null, dados_extras?: unknown }>} rows
 * @returns {string[]}
 */
export function coletarStoryIdsAtividades(rows) {
  /** @type {Set<string>} */
  const ids = new Set()
  for (const r of rows ?? []) {
    const tipo = String(r.tipo ?? '')
    if (tipo === 'curtiu_story') {
      const id = storyIdDeAtividadeCurtiu(r)
      if (id) ids.add(id)
    } else if (tipo === 'repostou_story') {
      const id = storyIdDeAtividadeRepost(r)
      if (id) ids.add(id)
    } else if (tipo === 'marcou_em_story') {
      const ex =
        r.dados_extras && typeof r.dados_extras === 'object' && !Array.isArray(r.dados_extras)
          ? /** @type {Record<string, unknown>} */ (r.dados_extras)
          : null
      const fromExtras = ex?.story_id != null ? String(ex.story_id).trim() : ''
      const fromAlvo = r.alvo_id != null ? String(r.alvo_id).trim() : ''
      const id = fromExtras || fromAlvo
      if (id) ids.add(id)
    }
  }
  return [...ids]
}

/**
 * @param {{ tipo?: string | null, alvo_id?: string | null, dados_extras?: unknown } | null | undefined} row
 * @param {Record<string, { conteudo_url?: string | null }>} [storyMetaMap]
 * @returns {string | null}
 */
export function resolverConteudoUrlStoryAtividade(row, storyMetaMap = {}) {
  if (!row) return null
  const ex =
    row.dados_extras && typeof row.dados_extras === 'object' && !Array.isArray(row.dados_extras)
      ? /** @type {Record<string, unknown>} */ (row.dados_extras)
      : null
  const fromExtras =
    typeof ex?.conteudo_url === 'string' && ex.conteudo_url.trim() !== '' ? ex.conteudo_url.trim() : null
  if (fromExtras) return fromExtras

  const tipo = String(row.tipo ?? '')
  let storyId = null
  if (tipo === 'curtiu_story') storyId = storyIdDeAtividadeCurtiu(row)
  else if (tipo === 'repostou_story') storyId = storyIdDeAtividadeRepost(row)
  else if (tipo === 'marcou_em_story') {
    storyId = ex?.story_id != null ? String(ex.story_id).trim() : String(row.alvo_id ?? '').trim()
    if (storyId === '') storyId = null
  }
  if (!storyId) return null
  const url = storyMetaMap[storyId]?.conteudo_url
  return url != null && String(url).trim() !== '' ? String(url).trim() : null
}

export function storyIdDeAtividadeRepost(row) {
  if (!row || String(row.tipo ?? '') !== 'repostou_story') return null
  const ex =
    row.dados_extras && typeof row.dados_extras === 'object' && !Array.isArray(row.dados_extras)
      ? /** @type {Record<string, unknown>} */ (row.dados_extras)
      : null
  const fromExtras = ex?.story_id != null ? String(ex.story_id).trim() : ''
  if (fromExtras) return fromExtras
  const alvo = row.alvo_id != null ? String(row.alvo_id).trim() : ''
  return alvo || null
}

/**
 * Curtida em story: visível na aba Seguindo enquanto o story ainda estiver ativo (24h).
 * Na aba Minha Conta confia na linha em `atividades` (limpeza no servidor quando expira).
 * @param {{ tipo?: string | null, alvo_id?: string | null, dados_extras?: unknown } | null | undefined} row
 * @param {Set<string>} storiesAtivos ids de stories com expira_em > agora (normalizados em minúsculas)
 * @param {{ abaMinhaConta?: boolean, pronto?: boolean }} [ctx]
 */
export function atividadeCurtiuStoryVisivel(row, storiesAtivos, ctx = {}) {
  if (!row || String(row.tipo ?? '') !== 'curtiu_story') return true
  if (ctx.abaMinhaConta) return true
  if (!ctx.pronto) return true

  const ex =
    row.dados_extras && typeof row.dados_extras === 'object' && !Array.isArray(row.dados_extras)
      ? /** @type {Record<string, unknown>} */ (row.dados_extras)
      : null
  const storyId = String(ex?.story_id ?? row.alvo_id ?? '')
    .trim()
    .toLowerCase()
  if (!storyId) return true
  return storiesAtivos.has(storyId)
}

/**
 * Atividades exibidas em "Minha Conta" devem representar interações no conteúdo pessoal do usuário.
 * Fluxos específicos de empresa ficam fora dessa aba, mesmo quando o usuário logado tem role empresa.
 * @param {{ tipo?: string | null, dados_extras?: unknown, autor_id?: string | null, usuario_id?: string | null } | null | undefined} row
 * @param {string} [usuarioLogadoId]
 */
export function atividadeVisivelNaMinhaContaPessoal(row, usuarioLogadoId) {
  if (!row) return false

  const uid = usuarioLogadoId != null ? String(usuarioLogadoId) : ''
  const autorId = row.autor_id != null ? String(row.autor_id) : ''
  const destId = row.usuario_id != null ? String(row.usuario_id) : ''
  if (uid && autorId && destId && autorId === destId && autorId === uid) return false

  const tipo = String(row.tipo ?? '')
  if (tipo === 'avaliou' || tipo === 'seguiu_empresa') return false

  const ex = row.dados_extras
  const seguidoTipo =
    ex && typeof ex === 'object' && !Array.isArray(ex)
      ? String(/** @type {Record<string, unknown>} */ (ex).seguido_tipo ?? '').toLowerCase()
      : ''
  if (tipo === 'seguiu' && seguidoTipo === 'empresa') return false

  return true
}

/**
 * Para contas empresa, "Minha Conta" mostra interações recebidas na página/conteúdo da empresa.
 * @param {{ tipo?: string | null, dados_extras?: unknown } | null | undefined} row
 */
export function atividadeVisivelNaMinhaContaEmpresa(row) {
  if (!row) return false
  const tipo = String(row.tipo ?? '')
  if (tipo === 'seguiu_empresa') return false

  if (tipo === 'seguiu') {
    const ex = row.dados_extras
    const seguidoTipo =
      ex && typeof ex === 'object' && !Array.isArray(ex)
        ? String(/** @type {Record<string, unknown>} */ (ex).seguido_tipo ?? '').toLowerCase()
        : ''
    if (seguidoTipo === 'empresa') return false
  }

  return true
}

/**
 * Chave estável para deduplicar notificação de novo seguidor (empresa ou perfil).
 * @param {{ tipo?: string | null, autor_id?: string | null, alvo_id?: string | null, dados_extras?: unknown }} row
 */
export function chaveAtividadeSeguidor(row) {
  if (!row) return ''
  const tipo = String(row.tipo ?? '')
  if (tipo !== 'seguiu' && tipo !== 'seguiu_empresa') return ''

  const ex =
    row.dados_extras && typeof row.dados_extras === 'object' && !Array.isArray(row.dados_extras)
      ? /** @type {Record<string, unknown>} */ (row.dados_extras)
      : {}

  const seguidorId = String(ex.seguidor_id ?? row.autor_id ?? '').trim()
  if (!seguidorId) return ''

  const empresaId = String(ex.empresa_id ?? (tipo === 'seguiu_empresa' ? row.alvo_id : '') ?? '').trim()
  if (empresaId) return `seg-emp:${seguidorId}:${empresaId}`

  const seguidoId = String(ex.seguido_id ?? row.usuario_id ?? '').trim()
  return seguidoId ? `seg-user:${seguidorId}:${seguidoId}` : `seg-user:${seguidorId}`
}

/**
 * @param {PostMeta | undefined | null} p
 * @returns {'foto' | 'texto' | 'avaliacao' | 'repost' | 'verificacao_profissional'}
 */
export function classificarCurtidaPost(p) {
  if (!p) return 'texto'
  if (p.post_original_id) return 'repost'
  const t = (p.tipo ?? 'texto').toLowerCase()
  if (t === 'verificacao_profissional') return 'verificacao_profissional'
  if (t === 'avaliacao') return 'avaliacao'
  if (p.avaliacao_meta && typeof p.avaliacao_meta === 'object' && !Array.isArray(p.avaliacao_meta)) {
    const keys = Object.keys(/** @type {Record<string, unknown>} */ (p.avaliacao_meta))
    if (keys.length > 0) return 'avaliacao'
  }
  if (t === 'foto' || t === 'misto') return 'foto'
  const url = p.conteudo_url || p.foto_url
  if (url && (!p.texto || !String(p.texto).trim())) return 'foto'
  return 'texto'
}

/**
 * Normaliza URL de mídia (authenticated → public no Supabase Storage).
 * @param {string | null | undefined} raw
 */
export function normalizarUrlFotoPost(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return null
  return s.replace('/storage/v1/object/authenticated/', '/storage/v1/object/public/') || null
}

/**
 * URL de mídia do post (foto).
 * @param {PostMeta | undefined | null} p
 */
export function urlFotoPost(p) {
  if (!p) return null
  const u = p.conteudo_url || p.foto_url
  return u ? normalizarUrlFotoPost(String(u)) : null
}

/**
 * @param {string} iso
 */
function dayKey(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

/**
 * Agrupa `curtiu_post` em blocos de fotos (máx. 10).
 * Regra:
 * - Se o liker curtir fotos de 1 único dono no dia, mantém o grupo "específico" (ex.: "curtiu X fotos de @dono").
 * - Se curtir fotos de donos diferentes no mesmo dia, agrupa num carrossel "coletivo" (ex.: "curtiu X fotos").
 * Entrada: ordenado do mais recente para o mais antigo.
 * @template T extends { tipo: string, autor_id: string, usuario_id: string, alvo_id: string, created_at: string }
 * @param {T[]} ordenadoDesc
 * @param {Record<string, PostMeta>} postMap
 * @returns {(
 *   | { kind: 'curtiu_post_fotos', autor_id: string, usuario_dono_id: string, rows: T[], created_at: string }
  *   | { kind: 'curtiu_post_fotos_multi', autor_id: string, rows: T[], created_at: string }
 *   | { kind: 'curtiu_post_solo', row: T, categoria: ReturnType<typeof classificarCurtidaPost> }
 *   | { kind: 'outro', row: T }
 * )[]}
 */
/**
 * Critério para remover linhas da lista após descurtir (UI imediata + Realtime).
 * @typedef {{ autorId?: string, postId?: string, comentarioId?: string, curtidaId?: string, atividadeId?: string, seguidorId?: string, seguidoId?: string }} RemoverAtividadeCurtidaCrit
 */

/**
 * @param {{ id: string, tipo: string, autor_id: string, alvo_id: string, usuario_id?: string, dados_extras?: unknown }} row
 * @param {RemoverAtividadeCurtidaCrit} crit
 * @returns {boolean} true se a linha deve ser removida
 */
export function atividadeDeveSerRemovidaAposDescurtir(row, crit) {
  if (crit.atividadeId && row.id === crit.atividadeId) return true

  const seguidorId = crit.seguidorId != null ? String(crit.seguidorId).trim() : ''
  const seguidoId = crit.seguidoId != null ? String(crit.seguidoId).trim() : ''
  if (seguidorId && seguidoId && (row.tipo === 'seguiu' || row.tipo === 'seguiu_empresa')) {
    const ex =
      row.dados_extras && typeof row.dados_extras === 'object' && !Array.isArray(row.dados_extras)
        ? /** @type {Record<string, unknown>} */ (row.dados_extras)
        : null
    const sId = String(ex?.seguidor_id ?? row.autor_id ?? '').trim()
    if (row.tipo === 'seguiu_empresa') {
      const empId = String(ex?.empresa_id ?? row.alvo_id ?? '').trim()
      if (sId === seguidorId && empId === seguidoId) return true
    } else {
      const dId = String(ex?.seguido_id ?? row.usuario_id ?? '').trim()
      if (sId === seguidorId && dId === seguidoId) return true
    }
  }

  const autorId = crit.autorId != null ? String(crit.autorId).trim() : ''
  if (!autorId || row.autor_id !== autorId) return false

  const postId = crit.postId != null ? String(crit.postId).trim() : ''
  if (postId && row.tipo === 'curtiu_post' && row.alvo_id === postId) return true

  const comentarioId = crit.comentarioId != null ? String(crit.comentarioId).trim() : ''
  if (comentarioId && row.tipo === 'curtiu_comentario' && row.alvo_id === comentarioId) return true

  if (crit.curtidaId) {
    const ex =
      row.dados_extras && typeof row.dados_extras === 'object' && !Array.isArray(row.dados_extras)
        ? /** @type {Record<string, unknown>} */ (row.dados_extras)
        : null
    const curtidaIdExtra = ex?.curtida_id != null ? String(ex.curtida_id).trim() : ''
    if (curtidaIdExtra === String(crit.curtidaId).trim()) return true
  }

  return false
}

/**
 * @template T extends { id: string, tipo: string, autor_id: string, alvo_id: string, dados_extras?: unknown }
 * @param {T[]} rows
 * @param {RemoverAtividadeCurtidaCrit} crit
 * @returns {T[]}
 */
export function filtrarAtividadesAposDescurtir(rows, crit) {
  if (!crit || (!crit.atividadeId && !crit.autorId && !(crit.seguidorId && crit.seguidoId))) return rows
  return rows.filter((r) => !atividadeDeveSerRemovidaAposDescurtir(r, crit))
}

export function agruparAtividadesCurtidasPost(ordenadoDesc, postMap) {
  /** @type {ReturnType<typeof agruparAtividadesCurtidasPost>} */
  const out = []
  let i = 0
  while (i < ordenadoDesc.length) {
    const r = ordenadoDesc[i]
    if (r.tipo !== 'curtiu_post') {
      out.push({ kind: 'outro', row: r })
      i++
      continue
    }
    const meta = postMap[r.alvo_id]
    const cat = classificarCurtidaPost(meta)
    if (cat !== 'foto') {
      out.push({ kind: 'curtiu_post_solo', row: r, categoria: cat })
      i++
      continue
    }
    const dk = dayKey(r.created_at)
    const grupo = [r]
    i++
    while (i < ordenadoDesc.length) {
      const x = ordenadoDesc[i]
      if (x.tipo !== 'curtiu_post') break
      const xm = postMap[x.alvo_id]
      if (classificarCurtidaPost(xm) !== 'foto') break
      if (x.autor_id !== r.autor_id || dayKey(x.created_at) !== dk) break
      grupo.push(x)
      i++
    }
    const donos = new Set(grupo.map((g) => g.usuario_id))
    const coletivo = donos.size > 1
    for (let k = 0; k < grupo.length; k += 10) {
      const chunk = grupo.slice(k, k + 10)
      if (coletivo) {
        out.push({
          kind: 'curtiu_post_fotos_multi',
          autor_id: r.autor_id,
          rows: chunk,
          created_at: chunk[0].created_at,
        })
      } else {
        out.push({
          kind: 'curtiu_post_fotos',
          autor_id: r.autor_id,
          usuario_dono_id: r.usuario_id,
          rows: chunk,
          created_at: chunk[0].created_at,
        })
      }
    }
  }
  return out
}

const CURTIU_POST_SOLO_CATEGORIAS_UI = new Set(['verificacao_profissional', 'texto', 'avaliacao', 'repost'])

/**
 * Tipos persistidos em `atividades` que ainda não têm componente na página.
 * Evita “buracos” no topo da lista (especialmente aba Seguindo).
 * @param {{ kind?: string, row?: { tipo?: string | null, alvo_id?: string | null, dados_extras?: unknown }, categoria?: string, rows?: unknown[] } | null | undefined} item
 */
export function atividadeAgrupadaTemUi(item) {
  if (!item) return false

  if (item.kind === 'curtiu_post_fotos' || item.kind === 'curtiu_post_fotos_multi') {
    return Array.isArray(item.rows) && item.rows.length > 0
  }

  if (item.kind === 'curtiu_post_solo') {
    return CURTIU_POST_SOLO_CATEGORIAS_UI.has(String(item.categoria ?? ''))
  }

  const r = item.row
  if (!r) return false

  const tipo = String(r.tipo ?? '')
  if (tipo === 'repostou_post' || tipo === 'avaliou' || tipo === 'seguiu_empresa') return false

  if (tipo === 'repostou_story') return Boolean(storyIdDeAtividadeRepost(r))

  if (tipo === 'marcou_em_story') {
    const ex =
      r.dados_extras && typeof r.dados_extras === 'object' && !Array.isArray(r.dados_extras)
        ? /** @type {Record<string, unknown>} */ (r.dados_extras)
        : null
    const storyId =
      ex?.story_id != null && String(ex.story_id).trim() !== ''
        ? String(ex.story_id).trim()
        : String(r.alvo_id ?? '').trim()
    return Boolean(storyId)
  }

  if (tipo === 'curtiu_comentario' || tipo === 'comentou') {
    const ex =
      r.dados_extras && typeof r.dados_extras === 'object' && !Array.isArray(r.dados_extras)
        ? /** @type {Record<string, unknown>} */ (r.dados_extras)
        : null
    const texto = ex?.texto != null ? String(ex.texto).trim() : ''
    return Boolean(texto)
  }

  return ['seguiu', 'curtiu_story'].includes(tipo)
}
