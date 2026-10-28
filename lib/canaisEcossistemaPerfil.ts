import type { SupabaseClient } from '@supabase/supabase-js'
import type { CanalComEcossistema } from '@/lib/canaisEcossistema'
import {
  resolverEcoCanaisDaEmpresa,
  resolverEcoCanaisDoProfissional,
  resolverEcoCanaisPorCidade,
} from '@/lib/ecoCanaisPorCidade'
import { listarEcossistemasDb } from '@/lib/ecossistemas'
import { buscarIdsEmpresasDosEcossistemas } from '@/lib/ecossistemaFiltro'

export async function resolverIdsBlocosCanaisProfissional(
  db: Pick<SupabaseClient, 'from'>,
  usuarioId: string,
): Promise<string[]> {
  if (!usuarioId) return []
  const bloco = await resolverEcoCanaisDoProfissional(db, { usuarioId })
  return bloco?.id ? [bloco.id] : []
}

export async function resolverIdsBlocosCanaisEmpresa(
  db: Pick<SupabaseClient, 'from'>,
  usuarioId: string,
): Promise<string[]> {
  if (!usuarioId) return []
  const bloco = await resolverEcoCanaisDaEmpresa(db, { usuarioId })
  return bloco?.id ? [bloco.id] : []
}

/** Canal global só entra se o `ecossistema_id` estiver nos blocos; canal da própria empresa passa. */
export function filtrarCanaisGlobaisDosBlocos<T extends CanalComEcossistema>(
  canais: T[] | null | undefined,
  blocoIds: string[],
): T[] {
  const set = new Set(blocoIds.map((id) => String(id).trim()).filter(Boolean))
  if (set.size === 0) return []
  return (canais ?? []).filter((c) => {
    const empresaId = c.empresa_id != null ? String(c.empresa_id).trim() : ''
    if (empresaId) return true
    const eco = c.ecossistema_id != null ? String(c.ecossistema_id).trim() : ''
    if (!eco) return false
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
  const set = new Set(blocoIds.map((id) => String(id).trim()).filter(Boolean))
  if (set.size === 0) return new Set()
  try {
    const blocos = await listarEcossistemasDb(db)
    const { data: emps, error } = await db.from('empresas').select('id, cidade').eq('status', 'aprovado')
    if (error) return buscarIdsEmpresasDosEcossistemas(db, [...set])
    const out = new Set<string>()
    for (const e of emps ?? []) {
      const bloco = resolverEcoCanaisPorCidade(e.cidade != null ? String(e.cidade) : '', blocos)
      if (bloco?.id && set.has(bloco.id)) out.add(String(e.id))
    }
    return out
  } catch {
    return buscarIdsEmpresasDosEcossistemas(db, [...set])
  }
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
