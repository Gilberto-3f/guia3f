import {
  CATEGORIAS_MOBILIDADE,
  categoriasCadastroDoBloco,
  gravarVinculosEcossistema,
  listarEcossistemasDb,
  parseCategoriasMobilidade,
  type CategoriaMobilidade,
  type EcossistemaBloco,
} from '@/lib/ecossistemas'
import { cidadePertenceAoBloco } from '@/lib/ecossistemaFiltro'

export { CATEGORIAS_MOBILIDADE, parseCategoriasMobilidade }

export function categoriaEhMobilidade(categoria: string | null | undefined): boolean {
  const c = String(categoria ?? '').trim()
  return (CATEGORIAS_MOBILIDADE as readonly string[]).includes(c)
}

export function categoriasMobilidadePorCidade(
  cidade: string | null | undefined,
  blocos: EcossistemaBloco[],
): CategoriaMobilidade[] {
  const bloco = resolverEcoCanaisPorCidade(cidade, blocos)
  return parseCategoriasMobilidade(bloco?.categorias_mobilidade)
}

export function categoriasCadastroPorCidade(
  cidade: string | null | undefined,
  blocos: EcossistemaBloco[],
): Array<CategoriaMobilidade | 'Anfitriao'> {
  return categoriasCadastroDoBloco(resolverEcoCanaisPorCidade(cidade, blocos))
}

export function primeiraCidadeAtuacao(raw: unknown): string {
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const s = String(item ?? '').trim()
      if (s) return s
    }
    return ''
  }
  return String(raw ?? '').trim()
}

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

export async function resolverEcoCanaisDoProfissional(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: { from: (table: string) => any },
  opts: { profissionalId?: string | null; usuarioId?: string | null },
): Promise<EcossistemaBloco | null> {
  const profissionalId = opts.profissionalId != null ? String(opts.profissionalId).trim() : ''
  const usuarioId = opts.usuarioId != null ? String(opts.usuarioId).trim() : ''
  if (!profissionalId && !usuarioId) return null

  let q = db.from('profissionais').select('cidade_atuacao')
  q = profissionalId ? q.eq('id', profissionalId) : q.eq('usuario_id', usuarioId)
  const { data: prof } = await q.maybeSingle()
  return resolverEcoCanaisPorCidadeDb(db, primeiraCidadeAtuacao(prof?.cidade_atuacao))
}

export async function gravarVinculoEcoPorCidade(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: { from: (table: string) => any },
  tipo: 'empresa' | 'profissional',
  perfilId: string,
  cidade: string | null | undefined,
): Promise<{ ok: boolean; error?: string; skipped?: boolean; ecoId?: string }> {
  const id = String(perfilId ?? '').trim()
  if (!id) return { ok: false, error: 'perfil_vazio' }
  const bloco = await resolverEcoCanaisPorCidadeDb(db, cidade)
  if (!bloco?.id) return { ok: false, error: 'ecossistema_cidade_nao_encontrado' }
  const vinculo = await gravarVinculosEcossistema(db, tipo, id, [bloco.id])
  return { ...vinculo, ecoId: bloco.id }
}
