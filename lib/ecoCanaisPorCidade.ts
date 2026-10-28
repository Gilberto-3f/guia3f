import { listarEcossistemasDb, type EcossistemaBloco } from '@/lib/ecossistemas'
import { cidadePertenceAoBloco } from '@/lib/ecossistemaFiltro'

/**
 * Eco de canais/comunidade a partir da cidade do endereço.
 * Se a cidade está numa região → região (sem duplicar cidade).
 * Se só existe eco cidade → cidade.
 * Sem fallback para o bloco padrão (Tríplice).
 */
export function resolverEcoCanaisPorCidade(
  cidade: string | null | undefined,
  blocos: EcossistemaBloco[],
): EcossistemaBloco | null {
  const raw = String(cidade ?? '').trim()
  if (!raw || blocos.length === 0) return null

  const hits = blocos.filter((b) => cidadePertenceAoBloco(raw, b))
  if (hits.length === 0) return null

  return hits.find((b) => b.tipo === 'regiao') ?? hits.find((b) => b.tipo === 'cidade') ?? hits[0]
}

export async function resolverEcoCanaisPorCidadeDb(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: { from: (table: string) => any },
  cidade: string | null | undefined,
): Promise<EcossistemaBloco | null> {
  try {
    const blocos = await listarEcossistemasDb(db)
    return resolverEcoCanaisPorCidade(cidade, blocos)
  } catch {
    return null
  }
}

/** Eco de canais da empresa pela cidade do cadastro/endereço — ignora vínculos N:N antigos. */
export async function resolverEcoCanaisDaEmpresa(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: { from: (table: string) => any },
  opts: { empresaId?: string | null; usuarioId?: string | null },
): Promise<EcossistemaBloco | null> {
  const empresaId = opts.empresaId != null ? String(opts.empresaId).trim() : ''
  const usuarioId = opts.usuarioId != null ? String(opts.usuarioId).trim() : ''
  if (!empresaId && !usuarioId) return null

  let q = db.from('empresas').select('cidade')
  q = empresaId ? q.eq('id', empresaId) : q.eq('usuario_id', usuarioId)
  const { data: emp } = await q.maybeSingle()
  return resolverEcoCanaisPorCidadeDb(db, emp?.cidade != null ? String(emp.cidade) : '')
}
