/** Cidades da Tríplice Fronteira (ordem fixa para gráficos). */
export const CIDADES_TRIPLICE_ORDEM = [
  'Foz do Iguaçu',
  'Ciudad del Este',
  'Puerto Iguazu',
] as const

export type CidadeTriplice = (typeof CIDADES_TRIPLICE_ORDEM)[number]

export const CORES_CIDADE_TRIPLICE: Record<CidadeTriplice, string> = {
  'Foz do Iguaçu': '#0097b2',
  'Ciudad del Este': '#00D443',
  'Puerto Iguazu': '#F1C40F',
}

/** Cinco categorias de mobilidade (ordem fixa para rankings). */
export const CATEGORIAS_MOBILIDADE_ORDEM = [
  'Motoristas de App',
  'Motoristas de Van',
  'Taxistas',
  'Guias de Turismo',
  'Anfitriões',
] as const

export type CategoriaMobilidade = (typeof CATEGORIAS_MOBILIDADE_ORDEM)[number]

export const CORES_CATEGORIA_MOBILIDADE: Record<CategoriaMobilidade, string> = {
  'Motoristas de App': '#0097b2',
  'Motoristas de Van': '#3498DB',
  Taxistas: '#F1C40F',
  'Guias de Turismo': '#00D443',
  Anfitriões: '#9B59B6',
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Normaliza texto de cidade para uma das 3 cidades da Tríplice Fronteira. */
export function normalizarCidadeTriplice(raw: string | null | undefined): CidadeTriplice | null {
  const n = stripAccents(String(raw ?? '').trim().toLowerCase())
  if (!n) return null
  if (n.includes('foz')) return 'Foz do Iguaçu'
  if (n.includes('ciudad') || n.includes('cde') || n.includes('del este')) return 'Ciudad del Este'
  if (n.includes('puerto') || n.includes('iguazu') || n.includes('iguacu')) {
    if (n.includes('foz')) return 'Foz do Iguaçu'
    return 'Puerto Iguazu'
  }
  return null
}

/** Normaliza categoria/slug do profissional para uma das 5 categorias de mobilidade. */
export function normalizarCategoriaMobilidade(raw: string | null | undefined): CategoriaMobilidade | null {
  const n = stripAccents(String(raw ?? '').trim().toLowerCase())
  if (!n) return null
  if (n.includes('app') || n.includes('motorista de app')) return 'Motoristas de App'
  if (n.includes('van') || n.includes('motorista de van')) return 'Motoristas de Van'
  if (n.includes('taxi')) return 'Taxistas'
  if (n.includes('guia')) return 'Guias de Turismo'
  if (n.includes('anfitr')) return 'Anfitriões'
  return null
}

export interface DistribuicaoProfissionalItem {
  tipo: string
  cidade: string
  total: number
}

export function agregarProfissionaisPorCategoria(
  rows: { categorias: unknown }[],
): { label: CategoriaMobilidade; valor: number; percentual: number; cor: string }[] {
  const porCat: Record<CategoriaMobilidade, number> = {
    'Motoristas de App': 0,
    'Motoristas de Van': 0,
    Taxistas: 0,
    'Guias de Turismo': 0,
    Anfitriões: 0,
  }

  for (const row of rows) {
    const cats = Array.isArray(row.categorias)
      ? (row.categorias as unknown[]).filter((x) => typeof x === 'string') as string[]
      : []
    const vistos = new Set<CategoriaMobilidade>()
    for (const raw of cats.length ? cats : ['outros']) {
      const cat = normalizarCategoriaMobilidade(raw)
      if (!cat || vistos.has(cat)) continue
      vistos.add(cat)
      porCat[cat] += 1
    }
  }

  const total = Object.values(porCat).reduce((a, b) => a + b, 0)
  return CATEGORIAS_MOBILIDADE_ORDEM.map((label) => ({
    label,
    valor: porCat[label],
    percentual: total > 0 ? (porCat[label] / total) * 100 : 0,
    cor: CORES_CATEGORIA_MOBILIDADE[label],
  }))
}

export function agregarProfissionaisPorCidade(
  itens: DistribuicaoProfissionalItem[],
): { label: CidadeTriplice; valor: number; percentual: number; cor: string }[] {
  const porCidade: Record<CidadeTriplice, number> = {
    'Foz do Iguaçu': 0,
    'Ciudad del Este': 0,
    'Puerto Iguazu': 0,
  }

  for (const item of itens) {
    const cidade = normalizarCidadeTriplice(item.cidade)
    if (!cidade) continue
    porCidade[cidade] += item.total ?? 0
  }

  const total = Object.values(porCidade).reduce((a, b) => a + b, 0)
  return CIDADES_TRIPLICE_ORDEM.map((label) => ({
    label,
    valor: porCidade[label],
    percentual: total > 0 ? (porCidade[label] / total) * 100 : 0,
    cor: CORES_CIDADE_TRIPLICE[label],
  }))
}

export function detalheCategoriasPorCidade(
  itens: DistribuicaoProfissionalItem[],
  cidadeAlvo: CidadeTriplice,
): { label: CategoriaMobilidade; valor: number; percentual: number; cor: string }[] {
  const porCat: Record<CategoriaMobilidade, number> = {
    'Motoristas de App': 0,
    'Motoristas de Van': 0,
    Taxistas: 0,
    'Guias de Turismo': 0,
    Anfitriões: 0,
  }

  for (const item of itens) {
    const cidade = normalizarCidadeTriplice(item.cidade)
    if (cidade !== cidadeAlvo) continue
    const cat = normalizarCategoriaMobilidade(item.tipo)
    if (!cat) continue
    porCat[cat] += item.total ?? 0
  }

  const total = Object.values(porCat).reduce((a, b) => a + b, 0)
  return CATEGORIAS_MOBILIDADE_ORDEM.map((label) => ({
    label,
    valor: porCat[label],
    percentual: total > 0 ? (porCat[label] / total) * 100 : 0,
    cor: CORES_CATEGORIA_MOBILIDADE[label],
  }))
}

export interface AtendimentoMobilidadeRow {
  categoria: string
  cidades: string[]
  createdAt: string
  status: string
}

export function agregarAtendimentosPorCategoria(
  rows: AtendimentoMobilidadeRow[],
  opts?: { desde?: Date | null; cidade?: CidadeTriplice | null },
): { label: CategoriaMobilidade; valor: number; percentual: number; cor: string }[] {
  const porCat: Record<CategoriaMobilidade, number> = {
    'Motoristas de App': 0,
    'Motoristas de Van': 0,
    Taxistas: 0,
    'Guias de Turismo': 0,
    Anfitriões: 0,
  }

  for (const row of rows) {
    if (opts?.desde) {
      const dt = new Date(row.createdAt)
      if (Number.isNaN(dt.getTime()) || dt < opts.desde) continue
    }
    if (opts?.cidade) {
      const match = row.cidades.some((c) => normalizarCidadeTriplice(c) === opts.cidade)
      if (!match) continue
    }
    const cat = normalizarCategoriaMobilidade(row.categoria)
    if (!cat) continue
    porCat[cat] += 1
  }

  const total = Object.values(porCat).reduce((a, b) => a + b, 0)
  return CATEGORIAS_MOBILIDADE_ORDEM.map((label) => ({
    label,
    valor: porCat[label],
    percentual: total > 0 ? (porCat[label] / total) * 100 : 0,
    cor: CORES_CATEGORIA_MOBILIDADE[label],
  }))
}

export function agregarHorariosPico(
  rows: AtendimentoMobilidadeRow[],
  opts?: {
    desde?: Date | null
    cidade?: CidadeTriplice | null
    categoria?: CategoriaMobilidade | null
    apenasConcluidos?: boolean
  },
): { hora: number; total: number }[] {
  const porHora = Array.from({ length: 24 }, (_, h) => ({ hora: h, total: 0 }))

  for (const row of rows) {
    if (opts?.apenasConcluidos !== false && row.status !== 'concluida') continue
    if (opts?.desde) {
      const dt = new Date(row.createdAt)
      if (Number.isNaN(dt.getTime()) || dt < opts.desde) continue
    }
    if (opts?.cidade) {
      const match = row.cidades.some((c) => normalizarCidadeTriplice(c) === opts.cidade)
      if (!match) continue
    }
    if (opts?.categoria) {
      const cat = normalizarCategoriaMobilidade(row.categoria)
      if (cat !== opts.categoria) continue
    }
    const dt = new Date(row.createdAt)
    if (Number.isNaN(dt.getTime())) continue
    porHora[dt.getHours()].total += 1
  }

  return porHora
}

export type PeriodoMobilidade = '7d' | '30d' | '90d'

export function dataLimiteMobilidade(periodo: PeriodoMobilidade): Date {
  const d = new Date()
  const dias = periodo === '7d' ? 7 : periodo === '30d' ? 30 : 90
  d.setDate(d.getDate() - dias)
  d.setHours(0, 0, 0, 0)
  return d
}
