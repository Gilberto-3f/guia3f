export type EcossistemaTipo = 'cidade' | 'regiao'

export type EcossistemaTileSexto = 'aguarde' | 'compras_cde' | 'servicos_locais'

export type EcossistemaCidade = {
  chave: string
  label: string
  pais: string | null
}

export type EcossistemaBloco = {
  id: string
  slug: string
  nome: string
  tipo: EcossistemaTipo
  descricao: string | null
  disponivel_home: boolean
  padrao: boolean
  tile_sexto: EcossistemaTileSexto
  ordem: number
  cidades: EcossistemaCidade[]
}

/** Cidades conhecidas (cadastro + seed). ADM pode acrescentar outras no formulário. */
export const CIDADES_CATALOGO: EcossistemaCidade[] = [
  { chave: 'Foz do Iguacu', label: 'Foz do Iguaçu', pais: 'BR' },
  { chave: 'Ciudad del Este', label: 'Ciudad del Este', pais: 'PY' },
  { chave: 'Puerto Iguazu', label: 'Puerto Iguazú', pais: 'AR' },
  { chave: 'Londrina', label: 'Londrina', pais: 'BR' },
]

export const TILE_SEXTO_OPCOES: { id: EcossistemaTileSexto; label: string }[] = [
  { id: 'aguarde', label: 'Aguarde (sem página)' },
  { id: 'compras_cde', label: 'Compras CDE (comparador)' },
  { id: 'servicos_locais', label: 'Serviços locais' },
]

export function slugDeNome(nome: string): string {
  return String(nome ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export function normalizarCidadeChave(raw: string): string {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function cidadeDoCatalogo(chaveOuLabel: string): EcossistemaCidade | null {
  const n = normalizarCidadeChave(chaveOuLabel).toLowerCase()
  if (!n) return null
  return (
    CIDADES_CATALOGO.find(
      (c) =>
        normalizarCidadeChave(c.chave).toLowerCase() === n ||
        normalizarCidadeChave(c.label).toLowerCase() === n,
    ) ?? null
  )
}

export function mapRowEcossistema(
  row: Record<string, unknown>,
  cidades: EcossistemaCidade[] = [],
): EcossistemaBloco {
  const tipo = String(row.tipo ?? 'cidade') === 'regiao' ? 'regiao' : 'cidade'
  const tile = String(row.tile_sexto ?? 'aguarde')
  const tile_sexto: EcossistemaTileSexto =
    tile === 'compras_cde' || tile === 'servicos_locais' ? tile : 'aguarde'
  return {
    id: String(row.id),
    slug: String(row.slug ?? ''),
    nome: String(row.nome ?? ''),
    tipo,
    descricao: row.descricao != null ? String(row.descricao) : null,
    disponivel_home: row.disponivel_home !== false,
    padrao: row.padrao === true,
    tile_sexto,
    ordem: Number(row.ordem ?? 0),
    cidades,
  }
}
