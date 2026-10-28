import type { SupabaseClient } from '@supabase/supabase-js'

const PADRAO_CACHE_MS = 60_000

let padraoCache: { id: string | null; at: number } | null = null

export type CanalComEcossistema = {
  empresa_id?: string | null
  ecossistema_id?: string | null
}

/** Canal de empresa (próprio) passa; canal global só no bloco informado. */
export function canalVisivelNoBlocoCanais(
  canal: CanalComEcossistema,
  blocoId: string | null | undefined,
): boolean {
  const empresaId = canal.empresa_id != null ? String(canal.empresa_id).trim() : ''
  if (empresaId) return true
  const alvo = blocoId != null ? String(blocoId).trim() : ''
  if (!alvo) return true
  const eco = canal.ecossistema_id != null ? String(canal.ecossistema_id).trim() : ''
  if (!eco) return true
  return eco === alvo
}

export async function buscarIdEcossistemaPadrao(
  db: Pick<SupabaseClient, 'from'>,
): Promise<string | null> {
  const agora = Date.now()
  if (padraoCache && agora - padraoCache.at < PADRAO_CACHE_MS) {
    return padraoCache.id
  }
  try {
    const { data, error } = await db.from('ecossistemas').select('id').eq('padrao', true).maybeSingle()
    if (error) {
      padraoCache = { id: null, at: agora }
      return null
    }
    const id = data?.id != null ? String(data.id) : null
    padraoCache = { id, at: agora }
    return id
  } catch {
    padraoCache = { id: null, at: agora }
    return null
  }
}

export function filtrarCanaisDoBloco<T extends CanalComEcossistema>(
  canais: T[] | null | undefined,
  blocoId: string | null | undefined,
): T[] {
  return (canais ?? []).filter((c) => canalVisivelNoBlocoCanais(c, blocoId))
}

/** Recorte ADM / fallback quando o perfil ainda não tem blocos N:N. */
export async function filtrarCanaisDoBlocoPadrao<T extends CanalComEcossistema>(
  db: Pick<SupabaseClient, 'from'>,
  canais: T[] | null | undefined,
): Promise<T[]> {
  const blocoId = await buscarIdEcossistemaPadrao(db)
  return filtrarCanaisDoBloco(canais, blocoId)
}

export async function garantirCanaisDoEcossistema(
  db: Pick<SupabaseClient, 'rpc'>,
  ecoId: string,
): Promise<{ ok: boolean; error?: string }> {
  const id = String(ecoId ?? '').trim()
  if (!id) return { ok: false, error: 'ecossistema_id obrigatório' }
  const { error } = await db.rpc('garantir_canais_ecossistema', { p_ecossistema_id: id })
  if (error) {
    const code = String((error as { code?: string }).code ?? '')
    const msg = String(error.message ?? '')
    if (code === '23505' || /idx_canais_global_unique|duplicate key/i.test(msg)) {
      return { ok: true }
    }
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

function rpcAusente(error: { message?: string; code?: string } | null | undefined): boolean {
  const code = String(error?.code ?? '')
  const msg = String(error?.message ?? '')
  return code === 'PGRST202' || code === '42883' || /does not exist|schema cache/i.test(msg)
}

/** Após criar/editar bloco: clona a árvore de canais e regrava vínculos pela cidade. */
export async function sincronizarCanaisEVinculosDoBloco(
  db: Pick<SupabaseClient, 'rpc'>,
  ecoId: string,
): Promise<{ ok: boolean; error?: string }> {
  const seed = await garantirCanaisDoEcossistema(db, ecoId)
  if (!seed.ok) return seed
  const { error } = await db.rpc('regravar_vinculos_eco_canais')
  if (!error || rpcAusente(error)) return { ok: true }
  return { ok: false, error: error.message }
}
