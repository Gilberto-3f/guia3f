import type { SupabaseClient } from '@supabase/supabase-js'
import { buscarIdEcossistemaPadrao, type CanalComEcossistema } from '@/lib/canaisEcossistema'
import {
  buscarEcoIdsDaEmpresa,
  buscarEcoIdsDoProfissional,
  buscarIdsEmpresasDosEcossistemas,
} from '@/lib/ecossistemaFiltro'

async function idsOuPadrao(
  db: Pick<SupabaseClient, 'from'>,
  ids: string[] | null,
): Promise<string[]> {
  if (ids && ids.length > 0) return ids
  const padrao = await buscarIdEcossistemaPadrao(db)
  return padrao ? [padrao] : []
}

export async function resolverIdsBlocosCanaisProfissional(
  db: Pick<SupabaseClient, 'from'>,
  usuarioId: string,
): Promise<string[]> {
  if (!usuarioId) return idsOuPadrao(db, [])
  const { data: prof } = await db.from('profissionais').select('id').eq('usuario_id', usuarioId).maybeSingle()
  const ids = await buscarEcoIdsDoProfissional(db, prof?.id != null ? String(prof.id) : '')
  return idsOuPadrao(db, ids)
}

export async function resolverIdsBlocosCanaisEmpresa(
  db: Pick<SupabaseClient, 'from'>,
  usuarioId: string,
): Promise<string[]> {
  if (!usuarioId) return idsOuPadrao(db, [])
  const { data: emp } = await db.from('empresas').select('id').eq('usuario_id', usuarioId).maybeSingle()
  const ids = await buscarEcoIdsDaEmpresa(db, emp?.id != null ? String(emp.id) : '')
  return idsOuPadrao(db, ids)
}

/** Canal global só entra se o `ecossistema_id` estiver nos blocos; canal da própria empresa passa. */
export function filtrarCanaisGlobaisDosBlocos<T extends CanalComEcossistema>(
  canais: T[] | null | undefined,
  blocoIds: string[],
): T[] {
  const set = new Set(blocoIds.map((id) => String(id).trim()).filter(Boolean))
  if (set.size === 0) return canais ?? []
  return (canais ?? []).filter((c) => {
    const empresaId = c.empresa_id != null ? String(c.empresa_id).trim() : ''
    if (empresaId) return true
    const eco = c.ecossistema_id != null ? String(c.ecossistema_id).trim() : ''
    if (!eco) return true
    return set.has(eco)
  })
}

/** Canais de outras empresas: só se a empresa atua num dos blocos do profissional. */
export function filtrarCanaisEmpresaDosBlocos<T extends CanalComEcossistema>(
  canais: T[] | null | undefined,
  empresaIdsDoBloco: Set<string> | null,
): T[] {
  if (!empresaIdsDoBloco) return canais ?? []
  return (canais ?? []).filter((c) => {
    const empresaId = c.empresa_id != null ? String(c.empresa_id).trim() : ''
    if (!empresaId) return true
    return empresaIdsDoBloco.has(empresaId)
  })
}

export async function buscarEmpresasDosBlocosCanais(
  db: Pick<SupabaseClient, 'from'>,
  blocoIds: string[],
): Promise<Set<string> | null> {
  return buscarIdsEmpresasDosEcossistemas(db, blocoIds)
}

export async function mapaNomesEcossistema(
  db: Pick<SupabaseClient, 'from'>,
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const { data, error } = await db.from('ecossistemas').select('id, nome')
  if (error) return map
  for (const row of data ?? []) {
    if (row?.id) map.set(String(row.id), String(row.nome ?? ''))
  }
  return map
}

export function precisaRotuloBlocoNosCanais(canais: CanalComEcossistema[]): boolean {
  const ecos = new Set<string>()
  for (const c of canais) {
    const empresaId = c.empresa_id != null ? String(c.empresa_id).trim() : ''
    if (empresaId) continue
    const eco = c.ecossistema_id != null ? String(c.ecossistema_id).trim() : ''
    if (eco) ecos.add(eco)
  }
  return ecos.size > 1
}

export function sufixoNomeBloco(
  ecoId: string | null | undefined,
  nomes: Map<string, string>,
  mostrar: boolean,
): string {
  if (!mostrar) return ''
  const eco = ecoId != null ? String(nomes.get(String(ecoId)) ?? '').trim() : ''
  return eco ? ` · ${eco}` : ''
}

export function rotuloCanalComBloco(
  base: string,
  ecoId: string | null | undefined,
  nomes: Map<string, string>,
  mostrar: boolean,
): string {
  const nome = String(base ?? '').trim() || 'Canal'
  return `${nome}${sufixoNomeBloco(ecoId, nomes, mostrar)}`
}
