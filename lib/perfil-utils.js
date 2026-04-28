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
 *
 * @param {{ tipo?: string; role?: string; empresa_id?: string | null; usuario_id: string }} item
 * @returns {string}
 */
export function getPerfilHref(item) {
  const tipo = String(item.tipo ?? '').toLowerCase()
  const role = String(item.role ?? '').toLowerCase()
  const ehEmpresa = tipo === 'empresa' || role === 'empresa'
  if (ehEmpresa && item.empresa_id) {
    return `/empresa/${item.empresa_id}`
  }
  return `/perfil/${item.usuario_id}`
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

