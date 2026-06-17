import type { LucideIcon } from 'lucide-react'
import { Car, MapPin, Smartphone, Users } from 'lucide-react'
import { normalizarCidadeTriplice, type CidadeTriplice } from '@/lib/mobilidadeRegional'

export type CategoriaTabeladoId = 'guia' | 'van' | 'taxista' | 'motorista_app'

export type CidadeOrigemTabeladoId = 'cde' | 'foz' | 'puerto_iguazu'

export type RotaTabelada = {
  id: string
  categoria: CategoriaTabeladoId
  cidadeOrigem: CidadeOrigemTabeladoId
  pontoPartida: string
  destinoFinal: string
  valorRota: number
  ativo: boolean
  createdAt: string
}

export const CATEGORIAS_TABELADOS: {
  id: CategoriaTabeladoId
  label: string
  Icon: LucideIcon
  cidades: CidadeOrigemTabeladoId[]
}[] = [
  {
    id: 'guia',
    label: 'Guias de Turismo',
    Icon: MapPin,
    cidades: ['cde', 'foz', 'puerto_iguazu'],
  },
  {
    id: 'van',
    label: 'Motoristas de Vans',
    Icon: Users,
    cidades: ['cde', 'foz', 'puerto_iguazu'],
  },
  {
    id: 'taxista',
    label: 'Taxistas',
    Icon: Car,
    cidades: ['cde', 'foz', 'puerto_iguazu'],
  },
  {
    id: 'motorista_app',
    label: 'Motoristas de APP',
    Icon: Smartphone,
    cidades: ['cde'],
  },
]

export const CIDADES_ORIGEM_TABELADO: Record<
  CidadeOrigemTabeladoId,
  { label: string; pontoPartida: string }
> = {
  cde: { label: 'Rotas de CDE', pontoPartida: 'Ciudad del Este' },
  foz: { label: 'Rotas de Foz do Iguaçu', pontoPartida: 'Foz do Iguaçu' },
  puerto_iguazu: { label: 'Rotas de Puerto Iguazú', pontoPartida: 'Puerto Iguazú' },
}

const TRIPLICE_PARA_TABELADO: Record<CidadeTriplice, CidadeOrigemTabeladoId> = {
  'Foz do Iguaçu': 'foz',
  'Ciudad del Este': 'cde',
  'Puerto Iguazu': 'puerto_iguazu',
}

export const ORDEM_CIDADES_TABELADO: CidadeOrigemTabeladoId[] = ['cde', 'foz', 'puerto_iguazu']

export function mapCidadeAtuacaoParaTabelado(
  raw: string | null | undefined,
): CidadeOrigemTabeladoId | null {
  const triplice = normalizarCidadeTriplice(raw)
  return triplice ? TRIPLICE_PARA_TABELADO[triplice] : null
}

export function ordenarCidadesTabeladas(
  ids: CidadeOrigemTabeladoId[],
  cidadeCadastro: CidadeOrigemTabeladoId | null,
): CidadeOrigemTabeladoId[] {
  const set = new Set(ids)
  const regionais = ORDEM_CIDADES_TABELADO.filter((id) => set.has(id))
  if (!cidadeCadastro || !set.has(cidadeCadastro)) return regionais
  return [cidadeCadastro, ...regionais.filter((id) => id !== cidadeCadastro)]
}

export function labelCategoriaTabelado(id: CategoriaTabeladoId): string {
  return CATEGORIAS_TABELADOS.find((c) => c.id === id)?.label ?? id
}

export function mapCategoriaProfissionalParaTabelado(
  categorias: string[] | string | null | undefined,
): CategoriaTabeladoId | null {
  const lista = Array.isArray(categorias)
    ? categorias
    : categorias
      ? [categorias]
      : []

  for (const raw of lista) {
    const c = String(raw ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
    if (c.includes('guia')) return 'guia'
    if (c === 'van' || c.includes('van')) return 'van'
    if (c.includes('taxista')) return 'taxista'
    if (c.includes('motorista') && c.includes('app')) return 'motorista_app'
    if (c === 'motorista_app' || c === 'motorista de app') return 'motorista_app'
  }
  return null
}

export function mapRotaTabeladaRow(row: Record<string, unknown>): RotaTabelada {
  return {
    id: String(row.id ?? ''),
    categoria: String(row.categoria ?? 'guia') as CategoriaTabeladoId,
    cidadeOrigem: String(row.cidade_origem ?? 'cde') as CidadeOrigemTabeladoId,
    pontoPartida: String(row.ponto_partida ?? ''),
    destinoFinal: String(row.destino_final ?? ''),
    valorRota: Number(row.valor_rota ?? 0),
    ativo: row.ativo !== false,
    createdAt: String(row.created_at ?? ''),
  }
}
