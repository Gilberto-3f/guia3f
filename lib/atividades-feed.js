/** @typedef {{ id: string, tipo: string | null, texto: string | null, conteudo_url: string | null, foto_url: string | null, post_original_id: string | null, avaliacao_meta: unknown, autor_id: string, autor_tipo?: string | null, empresa_id?: string | null }} PostMeta */

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
      const ex =
        r.dados_extras && typeof r.dados_extras === 'object' && !Array.isArray(r.dados_extras)
          ? /** @type {Record<string, unknown>} */ (r.dados_extras)
          : null
      const origId = ex?.story_original_id != null ? String(ex.story_original_id).trim() : ''
      if (origId) ids.add(origId)
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
 * ID da empresa quando a interação foi feita em modo hospedagem (anfitrião).
 * @param {{ dados_extras?: unknown } | null | undefined} row
 */
export function empresaInteratorIdDeAtividade(row) {
  if (!row) return null
  const ex =
    row.dados_extras && typeof row.dados_extras === 'object' && !Array.isArray(row.dados_extras)
      ? /** @type {Record<string, unknown>} */ (row.dados_extras)
      : null
  const id = ex?.empresa_interator_id != null ? String(ex.empresa_interator_id).trim() : ''
  return id || null
}

/** @param {{ dados_extras?: unknown, autor_id?: string | null } | null | undefined} row */
export function atividadeFeitaComoEmpresaHospedagem(row) {
  return Boolean(empresaInteratorIdDeAtividade(row))
}

/**
 * Garante `dados_extras.empresa_interator_id` a partir de `curtidas` / `comentarios`
 * (fallback quando o trigger de atividades não propagou o campo).
 * @template T extends { tipo?: string | null, dados_extras?: unknown }
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {T[]} rows
 * @returns {Promise<T[]>}
 */
export async function enriquecerAtividadesEmpresaInterator(supabase, rows) {
  if (!rows?.length) return rows ?? []

  /** @type {string[]} */
  const curtidaIds = []
  /** @type {string[]} */
  const comentarioIds = []

  for (const r of rows) {
    if (atividadeFeitaComoEmpresaHospedagem(r)) continue
    const tipo = String(r.tipo ?? '')
    const ex =
      r.dados_extras && typeof r.dados_extras === 'object' && !Array.isArray(r.dados_extras)
        ? /** @type {Record<string, unknown>} */ (r.dados_extras)
        : {}
    if (
      (tipo === 'curtiu_post' || tipo === 'curtiu_comentario' || tipo === 'curtiu_story') &&
      ex.curtida_id != null
    ) {
      const id = String(ex.curtida_id).trim()
      if (id) curtidaIds.push(id)
    }
    if (tipo === 'comentou' && ex.comentario_id != null) {
      const id = String(ex.comentario_id).trim()
      if (id) comentarioIds.push(id)
    }
  }

  /** @type {Map<string, string>} */
  const curtidaEmpresa = new Map()
  /** @type {Map<string, string>} */
  const comentarioEmpresa = new Map()

  const uniqCurtidas = [...new Set(curtidaIds)]
  if (uniqCurtidas.length > 0) {
    const { data } = await supabase
      .from('curtidas')
      .select('id, empresa_interator_id')
      .in('id', uniqCurtidas)
    for (const row of data ?? []) {
      const id = row.id != null ? String(row.id).trim() : ''
      const emp =
        row.empresa_interator_id != null ? String(row.empresa_interator_id).trim() : ''
      if (id && emp) curtidaEmpresa.set(id, emp)
    }
  }

  const uniqComentarios = [...new Set(comentarioIds)]
  if (uniqComentarios.length > 0) {
    const { data } = await supabase
      .from('comentarios')
      .select('id, empresa_interator_id')
      .in('id', uniqComentarios)
    for (const row of data ?? []) {
      const id = row.id != null ? String(row.id).trim() : ''
      const emp =
        row.empresa_interator_id != null ? String(row.empresa_interator_id).trim() : ''
      if (id && emp) comentarioEmpresa.set(id, emp)
    }
  }

  /** Fallback quando `curtida_id` não veio em `dados_extras` (atividades antigas). */
  /** @type {Map<string, string>} */
  const parPostCurtidaEmpresa = new Map()
  /** @type {{ autor: string, postId: string }[]} */
  const paresPost = []
  const paresPostVistos = new Set()
  for (const r of rows) {
    if (atividadeFeitaComoEmpresaHospedagem(r)) continue
    if (String(r.tipo ?? '') !== 'curtiu_post') continue
    const autor = String(r.autor_id ?? '').trim()
    const postId = String(r.alvo_id ?? '').trim()
    const key = `${autor}:${postId}`
    if (!autor || !postId || paresPostVistos.has(key)) continue
    paresPostVistos.add(key)
    paresPost.push({ autor, postId })
  }

  const PAR_CHUNK = 12
  for (let i = 0; i < paresPost.length; i += PAR_CHUNK) {
    const chunk = paresPost.slice(i, i + PAR_CHUNK)
    const orFilter = chunk.map((p) => `and(usuario_id.eq.${p.autor},post_id.eq.${p.postId})`).join(',')
    const { data } = await supabase
      .from('curtidas')
      .select('usuario_id, post_id, empresa_interator_id')
      .not('empresa_interator_id', 'is', null)
      .or(orFilter)
    for (const row of data ?? []) {
      const uid = row.usuario_id != null ? String(row.usuario_id).trim() : ''
      const pid = row.post_id != null ? String(row.post_id).trim() : ''
      const emp =
        row.empresa_interator_id != null ? String(row.empresa_interator_id).trim() : ''
      if (uid && pid && emp) parPostCurtidaEmpresa.set(`${uid}:${pid}`, emp)
    }
  }

  if (
    curtidaEmpresa.size === 0 &&
    comentarioEmpresa.size === 0 &&
    parPostCurtidaEmpresa.size === 0
  ) {
    return rows
  }

  return rows.map((r) => {
    if (atividadeFeitaComoEmpresaHospedagem(r)) return r
    const tipo = String(r.tipo ?? '')
    const ex =
      r.dados_extras && typeof r.dados_extras === 'object' && !Array.isArray(r.dados_extras)
        ? /** @type {Record<string, unknown>} */ ({ ...r.dados_extras })
        : /** @type {Record<string, unknown>} */ ({})

    let empId = ''
    if (
      (tipo === 'curtiu_post' || tipo === 'curtiu_comentario' || tipo === 'curtiu_story') &&
      ex.curtida_id != null
    ) {
      empId = curtidaEmpresa.get(String(ex.curtida_id).trim()) ?? ''
    } else if (tipo === 'comentou' && ex.comentario_id != null) {
      empId = comentarioEmpresa.get(String(ex.comentario_id).trim()) ?? ''
    }

    if (!empId && tipo === 'curtiu_post') {
      const autor = String(r.autor_id ?? '').trim()
      const postId = String(r.alvo_id ?? '').trim()
      if (autor && postId) empId = parPostCurtidaEmpresa.get(`${autor}:${postId}`) ?? ''
    }

    if (!empId) return r
    return { ...r, dados_extras: { ...ex, empresa_interator_id: empId } }
  })
}

/**
 * Post/story publicado como empresa (modo Hospedagem).
 * @param {{ autor_tipo?: string | null, empresa_id?: string | null } | null | undefined} meta
 */
export function postMetaEhConteudoEmpresa(meta) {
  if (!meta) return null
  const autorTipo = String(meta.autor_tipo ?? '').toLowerCase()
  if (autorTipo === 'empresa') return true
  if (autorTipo === 'profissional' || autorTipo === 'turista') return false
  /** Posts da página empresa podem vir só com `empresa_id` (sem `autor_tipo`). */
  const empresaId = meta.empresa_id != null ? String(meta.empresa_id).trim() : ''
  return empresaId !== ''
}

/**
 * @param {{ tipo?: string | null, alvo_id?: string | null, dados_extras?: unknown } | null | undefined} row
 * @param {{ postMetaMap?: Record<string, unknown>, storyMetaMap?: Record<string, { autor_tipo?: string | null }> }} ctx
 * @returns {boolean | null} true=empresa, false=pessoal, null=indeterminado (meta ainda não carregada)
 */
export function atividadeAlvoEhConteudoEmpresa(row, ctx = {}) {
  if (!row) return null
  const postMetaMap = /** @type {Record<string, PostMeta>} */ (ctx.postMetaMap ?? {})
  const storyMetaMap = ctx.storyMetaMap ?? {}
  const tipo = String(row.tipo ?? '')

  if (tipo === 'seguiu') return false

  if (tipo === 'curtiu_post' || tipo === 'repostou_post') {
    if (tipo === 'curtiu_post') {
      const likedId = String(row.alvo_id ?? '').trim()
      const liked = likedId ? postMetaMap[likedId] : null
      /** Curtida no repost: o alvo é a republicação (pessoal), não o original da empresa. */
      if (
        liked &&
        liked.post_original_id != null &&
        String(liked.post_original_id).trim() !== ''
      ) {
        return postMetaEhConteudoEmpresa(liked)
      }
    }
    const meta = postMetaCanonico(postMetaMap, row.alvo_id)
    if (!meta) {
      if (tipo === 'repostou_post') {
        const ex =
          row.dados_extras && typeof row.dados_extras === 'object' && !Array.isArray(row.dados_extras)
            ? /** @type {Record<string, unknown>} */ (row.dados_extras)
            : {}
        const orig =
          ex.post_original_id != null && String(ex.post_original_id).trim() !== ''
            ? String(ex.post_original_id).trim()
            : ''
        if (orig) {
          const metaOrig = postMetaMap[orig]
          if (!metaOrig) return null
          return postMetaEhConteudoEmpresa(metaOrig)
        }
      }
      return null
    }
    return postMetaEhConteudoEmpresa(meta)
  }

  if (tipo === 'curtiu_story') {
    const storyId = storyIdDeAtividadeCurtiu(row)
    if (!storyId) return null
    const meta = storyMetaMap[storyId]
    if (!meta) return null
    return String(meta.autor_tipo ?? '').toLowerCase() === 'empresa'
  }

  if (tipo === 'repostou_story') {
    const storyId = storyIdDeAtividadeRepost(row)
    if (!storyId) return null
    const meta = storyMetaMap[storyId]
    if (!meta) return null
    return String(meta.autor_tipo ?? '').toLowerCase() === 'empresa'
  }

  if (tipo === 'comentou' || tipo === 'curtiu_comentario') {
    const ex =
      row.dados_extras && typeof row.dados_extras === 'object' && !Array.isArray(row.dados_extras)
        ? /** @type {Record<string, unknown>} */ (row.dados_extras)
        : {}
    const postId = ex.post_id != null ? String(ex.post_id).trim() : ''
    if (postId) {
      const meta = postMetaCanonico(postMetaMap, postId)
      if (!meta) return null
      return postMetaEhConteudoEmpresa(meta)
    }
  }

  return false
}

/**
 * O conteúdo alvo da atividade pertence ao usuário logado (autor canônico do post/story ou perfil seguido).
 * @returns {boolean | null} null = meta ainda não carregada
 * @param {{ modoHospedagem?: boolean, modoAnfitriaoProf?: boolean }} [opts]
 */
export function atividadeConteudoEhDoUsuario(row, usuarioLogadoId, ctx = {}, opts = {}) {
  const uid = String(usuarioLogadoId ?? '').trim()
  if (!uid || !row) return false

  const destId = String(row.usuario_id ?? '').trim()
  const tipo = String(row.tipo ?? '')
  if (tipo === 'avaliou' || tipo === 'seguiu_empresa') return false

  if (tipo === 'seguiu') {
    const ex =
      row.dados_extras && typeof row.dados_extras === 'object' && !Array.isArray(row.dados_extras)
        ? /** @type {Record<string, unknown>} */ (row.dados_extras)
        : {}
    const seguidoId = String(ex.seguido_id ?? destId).trim()
    const seguidoTipo = String(ex.seguido_tipo ?? '').toLowerCase()
    if (seguidoTipo === 'empresa') return false
    return seguidoId === uid
  }

  const postMetaMap = /** @type {Record<string, PostMeta>} */ (ctx.postMetaMap ?? {})
  const ehEmpresa = atividadeAlvoEhConteudoEmpresa(row, ctx)

  if (opts.modoHospedagem) {
    if (ehEmpresa === null) return null
    return ehEmpresa === true
  }

  if (opts.modoAnfitriaoProf && ehEmpresa === true) return false

  if (tipo === 'curtiu_post') {
    const likedId = String(row.alvo_id ?? '').trim()
    const liked = likedId ? postMetaMap[likedId] : null
    if (!liked) return destId === uid ? null : false

    /** Curtida em republicação: dono = autor do repost (não o post original / empresa). */
    const ehRepost =
      liked.post_original_id != null && String(liked.post_original_id).trim() !== ''
    if (ehRepost) {
      if (opts.modoHospedagem) return false
      return String(liked.autor_id ?? '').trim() === uid
    }

    if (postMetaEhConteudoEmpresa(liked)) return opts.modoAnfitriaoProf ? false : null
    return String(liked.autor_id ?? '').trim() === uid
  }

  if (tipo === 'comentou') {
    const ex =
      row.dados_extras && typeof row.dados_extras === 'object' && !Array.isArray(row.dados_extras)
        ? /** @type {Record<string, unknown>} */ (row.dados_extras)
        : {}
    const postId = ex.post_id != null ? String(ex.post_id).trim() : ''
    if (!postId) return false
    const meta = postMetaCanonico(postMetaMap, postId)
    if (!meta) return destId === uid ? null : false
    if (postMetaEhConteudoEmpresa(meta)) return opts.modoAnfitriaoProf ? false : null
    return String(meta.autor_id ?? '').trim() === uid
  }

  if (tipo === 'curtiu_comentario') {
    const ex =
      row.dados_extras && typeof row.dados_extras === 'object' && !Array.isArray(row.dados_extras)
        ? /** @type {Record<string, unknown>} */ (row.dados_extras)
        : {}
    const postId = ex.post_id != null ? String(ex.post_id).trim() : ''
    if (postId) {
      const meta = postMetaCanonico(postMetaMap, postId)
      if (!meta) return destId === uid ? null : false
      if (postMetaEhConteudoEmpresa(meta)) return opts.modoAnfitriaoProf ? false : null
      if (String(meta.autor_id ?? '').trim() === uid) return true
    }
    return destId === uid
  }

  if (tipo === 'repostou_post') {
    const meta = postMetaCanonico(postMetaMap, row.alvo_id)
    if (!meta) return destId === uid ? null : false
    if (postMetaEhConteudoEmpresa(meta)) return opts.modoAnfitriaoProf ? false : null
    return String(meta.autor_id ?? '').trim() === uid
  }

  if (tipo === 'curtiu_story' || tipo === 'repostou_story' || tipo === 'marcou_em_story') {
    if (opts.modoAnfitriaoProf) {
      if (ehEmpresa === null) return null
      if (ehEmpresa === true) return false
    }
    if (opts.modoHospedagem) {
      if (ehEmpresa === null) return null
      if (ehEmpresa !== true) return false
    }
    if (tipo === 'repostou_story') {
      const ex =
        row.dados_extras && typeof row.dados_extras === 'object' && !Array.isArray(row.dados_extras)
          ? /** @type {Record<string, unknown>} */ (row.dados_extras)
          : {}
      const origAutor = String(ex.autor_original_id ?? '').trim()
      if (origAutor) return origAutor === uid
      const storyOrigId = ex.story_original_id != null ? String(ex.story_original_id).trim() : ''
      if (storyOrigId) {
        const storyMetaMap = ctx.storyMetaMap ?? {}
        const meta = storyMetaMap[storyOrigId]
        if (!meta || meta.autor_id == null || String(meta.autor_id).trim() === '') return null
        return String(meta.autor_id).trim() === uid
      }
      return false
    }
    if (tipo === 'curtiu_story' || tipo === 'marcou_em_story') {
      const storyMetaMap = ctx.storyMetaMap ?? {}
      let storyId = null
      if (tipo === 'curtiu_story') {
        storyId = storyIdDeAtividadeCurtiu(row)
      } else {
        const ex =
          row.dados_extras && typeof row.dados_extras === 'object' && !Array.isArray(row.dados_extras)
            ? /** @type {Record<string, unknown>} */ (row.dados_extras)
            : {}
        storyId = ex.story_id != null ? String(ex.story_id).trim() : String(row.alvo_id ?? '').trim()
        if (storyId === '') storyId = null
      }
      if (!storyId) return false
      const meta = storyMetaMap[storyId]
      if (!meta || meta.autor_id == null || String(meta.autor_id).trim() === '') {
        return destId === uid ? null : false
      }
      return String(meta.autor_id).trim() === uid
    }
    return false
  }

  return false
}

/**
 * Inbound em Minha Conta: interação de terceiro no conteúdo do usuário logado.
 * @returns {boolean | null} null = meta ainda não carregada (ocultar até resolver)
 * @param {{ modoHospedagem?: boolean, modoAnfitriaoProf?: boolean }} [opts]
 */
export function atividadeInboundMinhaContaEhDoUsuario(row, usuarioLogadoId, ctx = {}, opts = {}) {
  const uid = String(usuarioLogadoId ?? '').trim()
  if (!uid || !row) return false

  const autorId = String(row.autor_id ?? '').trim()
  if (autorId === uid) return false

  const pertence = atividadeConteudoEhDoUsuario(row, uid, ctx, opts)
  if (pertence === null) {
    const destId = String(row.usuario_id ?? '').trim()
    return destId === uid ? null : false
  }
  return pertence === true
}

/**
 * Minha conta — modo Anfitrião (perfil social): interações recebidas no conteúdo pessoal/profissional.
 */
export function atividadeVisivelMinhaContaModoAnfitriao(row, usuarioLogadoId, ctx = {}) {
  if (!atividadeVisivelNaMinhaContaPessoal(row, usuarioLogadoId)) return false
  const ok = atividadeInboundMinhaContaEhDoUsuario(row, usuarioLogadoId, ctx, { modoAnfitriaoProf: true })
  return ok === true
}

/**
 * Minha conta — modo Hospedagem: só interações recebidas no conteúdo da empresa.
 */
export function atividadeVisivelMinhaContaModoHospedagem(row, usuarioLogadoId, ctx = {}) {
  if (!atividadeVisivelNaMinhaContaEmpresa(row)) return false
  const ok = atividadeInboundMinhaContaEhDoUsuario(row, usuarioLogadoId, ctx, { modoHospedagem: true })
  return ok === true
}

/**
 * Gestor anfitrião na aba Seguindo: interação no perfil social só para quem segue;
 * interação em modo hospedagem (empresa_interator_id) visível como demais empresas do guia.
 * @param {{ autor_id?: string | null, dados_extras?: unknown }} row
 * @param {{ seguidosRede?: Set<string> | string[], gestoresAnfitriao?: Set<string> | string[] }} ctx
 */
export function atividadeGestorAnfitriaoVisivelNaAbaSeguindo(row, ctx = {}) {
  const autorId = row?.autor_id != null ? String(row.autor_id).trim() : ''
  if (!autorId) return true

  const gestores = ctx.gestoresAnfitriao
  const gestorSet =
    gestores instanceof Set
      ? gestores
      : new Set((gestores ?? []).map((id) => String(id).trim()).filter(Boolean))
  if (!gestorSet.has(autorId)) return true

  if (atividadeFeitaComoEmpresaHospedagem(row)) return true

  const seguidos = ctx.seguidosRede
  const redeSet =
    seguidos instanceof Set
      ? seguidos
      : new Set((seguidos ?? []).map((id) => String(id).trim()).filter(Boolean))
  return redeSet.has(autorId)
}

/**
 * Aba Seguindo — separa inbound (Minha Conta) vs outbound; personas anfitrião vs hospedagem.
 * Gestores de empresas do guia: interações no conteúdo de terceiros visíveis para todos
 * (equivalente a seguir empresas implicitamente), inclusive novos usuários sem rede.
 * Gestores anfitrião (dual mode): só interações em modo hospedagem; perfil social exige follow.
 * @param {{ postMetaMap?: Record<string, PostMeta>, storyMetaMap?: Record<string, StoryMeta>, seguidosRede?: Set<string> | string[], gestoresAnfitriao?: Set<string> | string[] }} ctx
 * @param {{ operaComoEmpresaHospedagem?: boolean, ehAnfitriao?: boolean, role?: string | null }} [opts]
 */
export function atividadeVisivelNaAbaSeguindo(row, usuarioLogadoId, ctx = {}, opts = {}) {
  const uid = usuarioLogadoId != null ? String(usuarioLogadoId).trim() : ''
  if (!uid) return true

  const autorId = row.autor_id != null ? String(row.autor_id).trim() : ''
  const destId = row.usuario_id != null ? String(row.usuario_id).trim() : ''
  const feitaComoEmpresa = atividadeFeitaComoEmpresaHospedagem(row)

  const ctxSeguindo = {
    postMetaMap: ctx.postMetaMap ?? {},
    storyMetaMap: ctx.storyMetaMap ?? {},
  }
  const modoOpts =
    opts.operaComoEmpresaHospedagem
      ? { modoHospedagem: true }
      : opts.ehAnfitriao && opts.role === 'profissional'
        ? { modoAnfitriaoProf: true }
        : {}

  const conteudoMeu = atividadeConteudoEhDoUsuario(row, uid, ctxSeguindo, modoOpts)
  /** Interação no meu conteúdo → só Minha Conta (inbound ou outbound). */
  if (conteudoMeu === true) return false
  /** Notificação endereçada a mim → só Minha Conta. */
  if (destId === uid) return false

  if (autorId === uid) {
    /** Modo hospedagem (viewer): só outbound feito como empresa. */
    if (opts.operaComoEmpresaHospedagem && !feitaComoEmpresa) return false
    /** Modo anfitrião (viewer): só outbound no perfil social (não como empresa). */
    if (opts.ehAnfitriao && opts.role === 'profissional' && !opts.operaComoEmpresaHospedagem && feitaComoEmpresa) {
      return false
    }
    return true
  }

  if (
    !atividadeGestorAnfitriaoVisivelNaAbaSeguindo(row, {
      seguidosRede: ctx.seguidosRede,
      gestoresAnfitriao: ctx.gestoresAnfitriao,
    })
  ) {
    return false
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
 * ID da publicação original (resolve repost → post_original_id).
 * @param {Record<string, PostMeta>} [postMap]
 * @param {string | null | undefined} alvoId
 */
export function postCanonicoId(postMap, alvoId) {
  const id = String(alvoId ?? '').trim()
  if (!id) return ''
  const meta = postMap?.[id]
  const orig = meta?.post_original_id
  if (orig != null && String(orig).trim() !== '') return String(orig).trim()
  return id
}

/**
 * Meta do post exibido na atividade (sempre a publicação original quando for repost).
 * @param {Record<string, PostMeta>} [postMap]
 * @param {string | null | undefined} alvoId
 * @returns {PostMeta | null | undefined}
 */
export function postMetaCanonico(postMap, alvoId) {
  const canonId = postCanonicoId(postMap, alvoId)
  if (!canonId) return null
  return postMap?.[canonId] ?? postMap?.[String(alvoId ?? '').trim()] ?? null
}

/** Chave da persona que realizou a interação (perfil profissional vs empresa hospedagem). */
export function personaInteratorKeyDeAtividade(row) {
  if (!row) return ''
  const emp = empresaInteratorIdDeAtividade(row)
  if (emp) return `emp:${emp}`
  const autor = String(row.autor_id ?? '').trim()
  return autor ? `prof:${autor}` : ''
}

/**
 * Deduplica curtidas do mesmo liker na mesma publicação original (vários reposts do mesmo conteúdo).
 * @param {{ tipo?: string | null, autor_id?: string | null, alvo_id?: string | null, dados_extras?: unknown }} row
 * @param {Record<string, PostMeta>} [postMap]
 */
export function chaveAtividadeCurtiuPost(row, postMap) {
  if (!row || String(row.tipo ?? '') !== 'curtiu_post') return ''
  const autor = String(row.autor_id ?? '').trim()
  const canon = postCanonicoId(postMap, row.alvo_id)
  if (!autor || !canon) return ''
  const persona = personaInteratorKeyDeAtividade(row) || `prof:${autor}`
  return `curtiu-post:${persona}:${canon}`
}

/**
 * @param {PostMeta | undefined | null} p
 */
export function postEhCatalogoProdutos(p) {
  if (!p) return false
  const t = String(p.tipo ?? '').toLowerCase()
  if (t === 'catalogo_produtos') return true
  const meta = p.avaliacao_meta
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    return String(/** @type {Record<string, unknown>} */ (meta).kind ?? '') === 'catalogo_produtos'
  }
  return false
}

/**
 * @param {PostMeta | undefined | null} p
 */
export function postEhCatalogoCardapio(p) {
  if (!p) return false
  const t = String(p.tipo ?? '').toLowerCase()
  if (t === 'catalogo_cardapio') return true
  const meta = p.avaliacao_meta
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    return String(/** @type {Record<string, unknown>} */ (meta).kind ?? '') === 'catalogo_cardapio'
  }
  return false
}

/**
 * @param {PostMeta | undefined | null} p
 */
export function postEhCatalogoServicos(p) {
  if (!p) return false
  const t = String(p.tipo ?? '').toLowerCase()
  if (t === 'catalogo_servicos') return true
  const meta = p.avaliacao_meta
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    return String(/** @type {Record<string, unknown>} */ (meta).kind ?? '') === 'catalogo_servicos'
  }
  return false
}

/**
 * @param {PostMeta | undefined | null} p
 */
export function postEhCatalogoAtrativos(p) {
  if (!p) return false
  const t = String(p.tipo ?? '').toLowerCase()
  if (t === 'catalogo_atrativos') return true
  const meta = p.avaliacao_meta
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    return String(/** @type {Record<string, unknown>} */ (meta).kind ?? '') === 'catalogo_atrativos'
  }
  return false
}

/**
 * @param {PostMeta | undefined | null} p
 */
export function postEhCatalogoAcomodacoes(p) {
  if (!p) return false
  const t = String(p.tipo ?? '').toLowerCase()
  if (t === 'catalogo_acomodacoes') return true
  const meta = p.avaliacao_meta
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    return String(/** @type {Record<string, unknown>} */ (meta).kind ?? '') === 'catalogo_acomodacoes'
  }
  return false
}

/**
 * @param {PostMeta | undefined | null} p
 */
export function postEhCatalogo(p) {
  return (
    postEhCatalogoProdutos(p) ||
    postEhCatalogoCardapio(p) ||
    postEhCatalogoServicos(p) ||
    postEhCatalogoAtrativos(p) ||
    postEhCatalogoAcomodacoes(p)
  )
}

/**
 * Snapshots de produtos no `avaliacao_meta` do post de catálogo.
 * @param {PostMeta | undefined | null} p
 * @returns {{ id: string, foto_url: string | null, nome: string }[]}
 */
export function produtosSnapCatalogoPost(p) {
  if (!p?.avaliacao_meta || typeof p.avaliacao_meta !== 'object' || Array.isArray(p.avaliacao_meta)) {
    return []
  }
  const meta = /** @type {Record<string, unknown>} */ (p.avaliacao_meta)
  const chave = Array.isArray(meta.acomodacoes)
    ? 'acomodacoes'
    : Array.isArray(meta.atrativos)
      ? 'atrativos'
      : Array.isArray(meta.servicos)
        ? 'servicos'
        : Array.isArray(meta.pratos)
          ? 'pratos'
          : 'produtos'
  const raw = Array.isArray(meta[chave]) ? meta[chave] : []
  const rotuloPadrao =
    chave === 'acomodacoes'
      ? 'Acomodação'
      : chave === 'atrativos'
        ? 'Atrativo'
        : chave === 'servicos'
          ? 'Serviço'
          : chave === 'pratos'
            ? 'Prato'
            : 'Produto'
  /** @type {{ id: string, foto_url: string | null, nome: string }[]} */
  const out = []
  for (const item of raw.slice(0, 3)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const o = /** @type {Record<string, unknown>} */ (item)
    out.push({
      id: o.id != null ? String(o.id) : `i-${out.length}`,
      foto_url:
        o.foto_url != null && String(o.foto_url).trim() !== '' ? String(o.foto_url) : null,
      nome: typeof o.nome === 'string' ? o.nome : rotuloPadrao,
    })
  }
  return out
}

/**
 * Empresa id do post de catálogo.
 * @param {PostMeta | undefined | null} p
 */
export function empresaIdCatalogoPost(p) {
  if (!p) return null
  if (p.empresa_id != null && String(p.empresa_id).trim() !== '') return String(p.empresa_id)
  const meta = p.avaliacao_meta
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    const eid = /** @type {Record<string, unknown>} */ (meta).empresa_id
    if (eid != null && String(eid).trim() !== '') return String(eid)
  }
  return null
}

/**
 * @param {PostMeta | undefined | null} p
 * @returns {'foto' | 'texto' | 'avaliacao' | 'repost' | 'verificacao_profissional' | 'catalogo_produtos' | 'catalogo_cardapio' | 'catalogo_servicos' | 'catalogo_atrativos' | 'catalogo_acomodacoes'}
 */
export function classificarCurtidaPost(p) {
  if (!p) return 'texto'
  /** Curtida em republicação: prioriza `repost` (catálogo republicado usa UI curtiu_repost). */
  if (p.post_original_id != null && String(p.post_original_id).trim() !== '') return 'repost'
  if (postEhCatalogoAcomodacoes(p)) return 'catalogo_acomodacoes'
  if (postEhCatalogoAtrativos(p)) return 'catalogo_atrativos'
  if (postEhCatalogoServicos(p)) return 'catalogo_servicos'
  if (postEhCatalogoCardapio(p)) return 'catalogo_cardapio'
  if (postEhCatalogoProdutos(p)) return 'catalogo_produtos'
  const t = (p.tipo ?? 'texto').toLowerCase()
  if (t === 'verificacao_profissional') return 'verificacao_profissional'
  if (t === 'avaliacao') return 'avaliacao'
  if (p.avaliacao_meta && typeof p.avaliacao_meta === 'object' && !Array.isArray(p.avaliacao_meta)) {
    const meta = /** @type {Record<string, unknown>} */ (p.avaliacao_meta)
    if (String(meta.kind ?? '') === 'catalogo_produtos') return 'catalogo_produtos'
    if (String(meta.kind ?? '') === 'catalogo_cardapio') return 'catalogo_cardapio'
    if (String(meta.kind ?? '') === 'catalogo_servicos') return 'catalogo_servicos'
    if (String(meta.kind ?? '') === 'catalogo_atrativos') return 'catalogo_atrativos'
    if (String(meta.kind ?? '') === 'catalogo_acomodacoes') return 'catalogo_acomodacoes'
    const keys = Object.keys(meta)
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
 * Dono do conteúdo para agrupamento/exibição (separa perfil pessoal vs página empresa).
 * @param {PostMeta | null | undefined} meta
 * @param {string | null | undefined} fallbackUsuarioId
 * @returns {{ chave: string, usuario_id: string, empresa_id: string | null, donor_tipo: 'empresa' | 'usuario' }}
 */
export function resolverDonoPostAtividade(meta, fallbackUsuarioId) {
  if (meta && postMetaEhConteudoEmpresa(meta)) {
    const empresaId = meta.empresa_id != null ? String(meta.empresa_id).trim() : ''
    if (empresaId) {
      const usuarioId =
        meta.autor_id != null && String(meta.autor_id).trim() !== ''
          ? String(meta.autor_id).trim()
          : String(fallbackUsuarioId ?? '').trim()
      return {
        chave: `emp:${empresaId}`,
        usuario_id: usuarioId,
        empresa_id: empresaId,
        donor_tipo: 'empresa',
      }
    }
  }
  const uid =
    meta?.autor_id != null && String(meta.autor_id).trim() !== ''
      ? String(meta.autor_id).trim()
      : String(fallbackUsuarioId ?? '').trim()
  return {
    chave: `user:${uid}`,
    usuario_id: uid,
    empresa_id: null,
    donor_tipo: 'usuario',
  }
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
 *   | { kind: 'curtiu_post_fotos', autor_id: string, persona_key: string, usuario_dono_id: string, empresa_dono_id: string | null, donor_tipo: 'empresa' | 'usuario', rows: T[], created_at: string }
 *   | { kind: 'curtiu_post_fotos_multi', autor_id: string, persona_key: string, rows: T[], created_at: string }
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
    const personaKey = personaInteratorKeyDeAtividade(r)
    const grupo = [r]
    i++
    while (i < ordenadoDesc.length) {
      const x = ordenadoDesc[i]
      if (x.tipo !== 'curtiu_post') break
      const xm = postMap[x.alvo_id]
      if (classificarCurtidaPost(xm) !== 'foto') break
      if (
        x.autor_id !== r.autor_id ||
        dayKey(x.created_at) !== dk ||
        personaInteratorKeyDeAtividade(x) !== personaKey
      ) {
        break
      }
      grupo.push(x)
      i++
    }
    const donoDe = (g) => {
      const canon = postMetaCanonico(postMap, g.alvo_id)
      return resolverDonoPostAtividade(canon, g.usuario_id)
    }
    const chavesDono = new Set(grupo.map((g) => donoDe(g).chave))
    const coletivo = chavesDono.size > 1

    if (coletivo) {
      for (let k = 0; k < grupo.length; k += 10) {
        const chunk = grupo.slice(k, k + 10)
        out.push({
          kind: 'curtiu_post_fotos_multi',
          autor_id: r.autor_id,
          persona_key: personaKey,
          rows: chunk,
          created_at: chunk[0].created_at,
        })
      }
    } else {
      const dono = donoDe(r)
      for (let k = 0; k < grupo.length; k += 10) {
        const chunk = grupo.slice(k, k + 10)
        out.push({
          kind: 'curtiu_post_fotos',
          autor_id: r.autor_id,
          persona_key: personaKey,
          usuario_dono_id: dono.usuario_id,
          empresa_dono_id: dono.empresa_id,
          donor_tipo: dono.donor_tipo,
          rows: chunk,
          created_at: chunk[0].created_at,
        })
      }
    }
  }
  return out
}

const CURTIU_POST_SOLO_CATEGORIAS_UI = new Set([
  'verificacao_profissional',
  'texto',
  'avaliacao',
  'repost',
  'catalogo_produtos',
  'catalogo_cardapio',
  'catalogo_servicos',
  'catalogo_atrativos',
  'catalogo_acomodacoes',
])

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
  if (tipo === 'avaliou' || tipo === 'seguiu_empresa') return false

  if (tipo === 'repostou_post') return Boolean(String(r.alvo_id ?? '').trim())

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

/**
 * Carrega meta mínima de posts para filtros de aba / contador (inclui posts originais de reposts).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string[]} postIds
 * @returns {Promise<Record<string, PostMeta>>}
 */
export async function carregarPostMetaMapBasico(supabase, postIds) {
  const uniq = [...new Set(postIds.map((id) => String(id ?? '').trim()).filter(Boolean))]
  if (uniq.length === 0) return {}

  const sel =
    'id, tipo, texto, conteudo_url, foto_url, post_original_id, avaliacao_meta, autor_id, autor_tipo, empresa_id'
  const CHUNK = 80
  /** @type {Record<string, PostMeta>} */
  const m = {}

  for (let i = 0; i < uniq.length; i += CHUNK) {
    const chunk = uniq.slice(i, i + CHUNK)
    const { data, error } = await supabase.from('posts').select(sel).in('id', chunk)
    if (error || !data?.length) continue
    for (const raw of data) {
      const p = /** @type {PostMeta} */ (raw)
      m[String(p.id)] = p
    }
  }

  const originais = [
    ...new Set(
      Object.values(m)
        .map((p) => p.post_original_id)
        .filter((x) => x != null && String(x).trim() !== '')
        .map((x) => String(x).trim()),
    ),
  ].filter((id) => !m[id])

  for (let i = 0; i < originais.length; i += CHUNK) {
    const chunk = originais.slice(i, i + CHUNK)
    const { data, error } = await supabase.from('posts').select(sel).in('id', chunk)
    if (error || !data?.length) continue
    for (const raw of data) {
      const p = /** @type {PostMeta} */ (raw)
      m[String(p.id)] = p
    }
  }

  return m
}

/**
 * Conta notificações não lidas alinhadas à aba Minha Conta (filtro por dono do conteúdo + dedupe).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {{ limite?: number, modoHospedagem?: boolean, modoAnfitriaoProf?: boolean }} [opts]
 */
export async function contarAtividadesMinhaContaNaoLidas(supabase, userId, opts = {}) {
  const uid = String(userId ?? '').trim()
  if (!uid) return 0

  const limite = opts.limite ?? 250
  const modoOpts = opts.modoHospedagem
    ? { modoHospedagem: true }
    : opts.modoAnfitriaoProf
      ? { modoAnfitriaoProf: true }
      : {}

  const { data, error } = await supabase
    .from('atividades')
    .select('id, tipo, dados_extras, autor_id, usuario_id, alvo_id, lida, created_at')
    .eq('usuario_id', uid)
    .eq('lida', false)
    .neq('autor_id', uid)
    .not('tipo', 'in', '(avaliou,seguiu_empresa)')
    .order('created_at', { ascending: false })
    .limit(limite)

  if (error || !data?.length) return 0

  const candidatas = data.filter((row) =>
    opts.modoHospedagem
      ? atividadeVisivelNaMinhaContaEmpresa(row)
      : atividadeVisivelNaMinhaContaPessoal(row, uid),
  )
  if (candidatas.length === 0) return 0

  /** @type {string[]} */
  const postIds = []
  for (const r of candidatas) {
    if ((r.tipo === 'curtiu_post' || r.tipo === 'repostou_post') && r.alvo_id) {
      postIds.push(String(r.alvo_id))
    }
    const ex = r.dados_extras
    if (ex && typeof ex === 'object' && !Array.isArray(ex)) {
      const rec = /** @type {Record<string, unknown>} */ (ex)
      const pid = rec.post_id
      if (pid != null && String(pid).trim() !== '') postIds.push(String(pid).trim())
      const orig = rec.post_original_id
      if (orig != null && String(orig).trim() !== '') postIds.push(String(orig).trim())
    }
  }

  const postMetaMap = await carregarPostMetaMapBasico(supabase, postIds)
  const ctx = { postMetaMap, storyMetaMap: {} }

  const comentariosVistos = new Set()
  const seguidoresVistos = new Set()
  const curtidasPostVistas = new Set()
  let total = 0

  for (const r of candidatas) {
    if (atividadeInboundMinhaContaEhDoUsuario(r, uid, ctx, modoOpts) !== true) continue

    const tipo = String(r.tipo ?? '')
    if (tipo === 'seguiu') {
      const ex = r.dados_extras ?? {}
      const seguidoTipo =
        typeof ex.seguido_tipo === 'string' ? ex.seguido_tipo.trim().toLowerCase() : ''
      if (seguidoTipo === 'empresa') continue
      const chave = chaveAtividadeSeguidor(r)
      if (chave) {
        if (seguidoresVistos.has(chave)) continue
        seguidoresVistos.add(chave)
      }
    }
    if (tipo === 'comentou' || tipo === 'curtiu_comentario') {
      const ex = r.dados_extras ?? {}
      const texto = typeof ex.texto === 'string' ? ex.texto.trim() : ''
      if (!texto) continue
      const comentarioId =
        typeof ex.comentario_id === 'string' && ex.comentario_id.trim() !== ''
          ? ex.comentario_id.trim()
          : tipo === 'curtiu_comentario'
            ? String(r.alvo_id ?? '').trim()
            : ''
      if (comentarioId) {
        const key = `${tipo}:${comentarioId}`
        if (comentariosVistos.has(key)) continue
        comentariosVistos.add(key)
      }
    }
    if (tipo === 'curtiu_post') {
      const chaveCurtida = chaveAtividadeCurtiuPost(r, postMetaMap)
      if (chaveCurtida) {
        if (curtidasPostVistas.has(chaveCurtida)) continue
        curtidasPostVistas.add(chaveCurtida)
      }
    }

    total += 1
  }

  return total
}
