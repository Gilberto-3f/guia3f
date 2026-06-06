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

export function agruparPorCategoria<T extends { categoria: string }>(items: T[]): Record<CategoriaProfissionalFunil, T[]> {
  const porCategoria = Object.fromEntries(CATEGORIAS_ORDEM.map((cat) => [cat, [] as T[]])) as Record<
    CategoriaProfissionalFunil,
    T[]
  >

  for (const item of items) {
    const key = item.categoria as CategoriaProfissionalFunil
    if ((CATEGORIAS_ORDEM as readonly string[]).includes(key)) {
      porCategoria[key].push(item)
    }
  }

  return porCategoria
}
