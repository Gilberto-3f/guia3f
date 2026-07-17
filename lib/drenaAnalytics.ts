import { normalizarTextoTaxonomia } from '@/lib/comprasCdeCatalogo'

export type PeriodoDrena = '24h' | '7d' | '30d'

export type TermoRanking = {
  termo: string
  termo_normalizado: string
  total: number
}

export type FatiaCategoria = {
  id: string
  nome: string
  total: number
  percentual: number
  cor: string
}

export type PontoHistorico = {
  label: string
  ano: number
  mes: number
  total: number
}

export type SnapshotMensalRow = {
  termo: string
  termo_normalizado: string
  tipo: string
  total_buscas: number
}

const CORES_PIZZA = [
  '#0097b2',
  '#00D443',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#64748b',
  '#84cc16',
  '#f97316',
]

export function inicioPeriodoIso(periodo: PeriodoDrena): string {
  const ms =
    periodo === '24h'
      ? 24 * 60 * 60 * 1000
      : periodo === '7d'
        ? 7 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000
  return new Date(Date.now() - ms).toISOString()
}

export function agregarRankingTermos(
  rows: { termo_busca?: string | null }[],
  limite = 50,
): TermoRanking[] {
  const map = new Map<string, { termo: string; total: number }>()
  for (const r of rows) {
    const termo = String(r.termo_busca ?? '').trim()
    if (!termo) continue
    const norm = normalizarTextoTaxonomia(termo)
    if (!norm) continue
    const cur = map.get(norm)
    if (cur) cur.total += 1
    else map.set(norm, { termo, total: 1 })
  }
  return [...map.entries()]
    .map(([termo_normalizado, d]) => ({
      termo: d.termo,
      termo_normalizado,
      total: d.total,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limite)
}

export function agregarPizzaCategorias(
  rows: { categoria_id?: string | null; categorias?: { id?: string; nome?: string } | null }[],
): FatiaCategoria[] {
  const map = new Map<string, { nome: string; total: number }>()
  for (const r of rows) {
    const id = r.categoria_id ? String(r.categoria_id) : r.categorias?.id ? String(r.categorias.id) : ''
    if (!id) continue
    const nome = r.categorias?.nome ? String(r.categorias.nome) : 'Categoria'
    const cur = map.get(id)
    if (cur) cur.total += 1
    else map.set(id, { nome, total: 1 })
  }
  return pizzaFromContagens(map)
}

/** Monta fatias de pizza a partir de totais já agregados por id. */
export function pizzaFromContagens(
  map: Map<string, { nome: string; total: number }>,
): FatiaCategoria[] {
  const totalGeral = [...map.values()].reduce((a, b) => a + b.total, 0)
  return [...map.entries()]
    .map(([id, d], i) => ({
      id,
      nome: d.nome,
      total: d.total,
      percentual: totalGeral ? (d.total / totalGeral) * 100 : 0,
      cor: CORES_PIZZA[i % CORES_PIZZA.length],
    }))
    .sort((a, b) => b.total - a.total)
}

export type ProdutoRankingItem = {
  id: string
  nome: string
  fotoUrl: string | null
  categoriaId: string | null
  categoriaNome: string
  subcategoriaNome: string | null
  marcaNome: string | null
  cliques: number
  impressoes: number
  recomendacoes: number
}

export type SecaoCategoriaRanking = {
  categoriaId: string
  categoriaNome: string
  ordem: number
  produtos: ProdutoRankingItem[]
  totalCliques: number
  totalRecomendacoes: number
}

export function serieHistoricoTermo(
  snapshots: { ano: number; mes: number; total_buscas: number }[],
  meses = 12,
): PontoHistorico[] {
  const agora = new Date()
  const pontos: PontoHistorico[] = []
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - i, 1))
    const ano = d.getUTCFullYear()
    const mes = d.getUTCMonth() + 1
    const hit = snapshots.find((s) => s.ano === ano && s.mes === mes)
    pontos.push({
      label: `${String(mes).padStart(2, '0')}/${ano}`,
      ano,
      mes,
      total: hit?.total_buscas ?? 0,
    })
  }
  return pontos
}

export function labelMes(mes: number): string {
  const nomes = [
    '',
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ]
  return nomes[mes] ?? String(mes)
}
