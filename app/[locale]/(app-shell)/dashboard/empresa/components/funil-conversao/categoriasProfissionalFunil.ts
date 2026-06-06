import { Bus, Car, Hotel, Smartphone, type LucideIcon } from 'lucide-react'

export const CATEGORIAS_ORDEM = ['guias', 'taxistas', 'vans', 'apps', 'anfitrioes'] as const

export type CategoriaProfissionalFunil = (typeof CATEGORIAS_ORDEM)[number]

export const CATEGORIAS_CONFIG: Record<CategoriaProfissionalFunil, { label: string; Icon: LucideIcon }> = {
  guias: { label: 'Guias de Turismo', Icon: Bus },
  taxistas: { label: 'Taxistas', Icon: Car },
  vans: { label: 'Motoristas de Van', Icon: Bus },
  apps: { label: 'Motoristas de App', Icon: Smartphone },
  anfitrioes: { label: 'Anfitriões', Icon: Hotel },
}

export function normalizarCategoriaProfissionalSlug(raw: string): CategoriaProfissionalFunil | null {
  const n = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if ((CATEGORIAS_ORDEM as readonly string[]).includes(n)) return n as CategoriaProfissionalFunil
  if (n.includes('guia') || n === 'guia') return 'guias'
  if (n.includes('taxi') || n === 'taxista') return 'taxistas'
  if (n.includes('van') || n === 'motorista_van') return 'vans'
  if (n.includes('app') || n === 'motorista_app' || n === 'motoristas_app') return 'apps'
  if (n.includes('anfitri') || n === 'anfitriao') return 'anfitrioes'
  return null
}

export function agruparPorCategoria<T extends { categoria: string }>(items: T[]): Record<CategoriaProfissionalFunil, T[]> {
  const porCategoria = Object.fromEntries(CATEGORIAS_ORDEM.map((cat) => [cat, [] as T[]])) as Record<
    CategoriaProfissionalFunil,
    T[]
  >

  for (const item of items) {
    const key = normalizarCategoriaProfissionalSlug(item.categoria)
    if (key) {
      porCategoria[key].push(item)
    }
  }

  return porCategoria
}
