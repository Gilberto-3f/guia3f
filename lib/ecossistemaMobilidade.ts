export const SLUG_ECO_TRIPLICE = 'triplice-fronteira'

export const CATEGORIAS_MOBILIDADE = ['Guia', 'Taxista', 'Van', 'Motorista de App'] as const

export type CategoriaMobilidade = (typeof CATEGORIAS_MOBILIDADE)[number]

const PLACA_CATEGORIAS = new Set<string>(['Guia', 'Taxista', 'Van'])

const ALLOWED = new Set<string>(CATEGORIAS_MOBILIDADE)

/** Aceita array ou lista; descarta valores inválidos; ordem canônica. */
export function parseCategoriasMobilidade(raw: unknown): CategoriaMobilidade[] {
  const items: unknown[] = Array.isArray(raw)
    ? raw
    : typeof raw === 'string' && raw.trim()
      ? raw.split(',')
      : []
  const seen = new Set<CategoriaMobilidade>()
  for (const item of items) {
    const s = String(item ?? '').trim()
    if (!ALLOWED.has(s)) continue
    seen.add(s as CategoriaMobilidade)
  }
  return CATEGORIAS_MOBILIDADE.filter((c) => seen.has(c))
}

export function categoriasMobilidadeDoBloco(
  bloco: { categorias_mobilidade?: unknown } | null | undefined,
): CategoriaMobilidade[] {
  return parseCategoriasMobilidade(bloco?.categorias_mobilidade)
}

export function blocoEhTripliceFronteira(bloco: { slug?: string } | null | undefined): boolean {
  return String(bloco?.slug ?? '').trim() === SLUG_ECO_TRIPLICE
}

export function categoriaGanhaPlacaVermelha(
  categoria: string | null | undefined,
  bloco: { slug?: string } | null | undefined,
): boolean {
  const c = String(categoria ?? '').trim()
  if (!PLACA_CATEGORIAS.has(c)) return false
  return blocoEhTripliceFronteira(bloco)
}

export function categoriaMobilidadeParaSlug(
  cat: CategoriaMobilidade,
): 'guia' | 'taxista' | 'van' | 'motorista_app' {
  if (cat === 'Guia') return 'guia'
  if (cat === 'Taxista') return 'taxista'
  if (cat === 'Van') return 'van'
  return 'motorista_app'
}

export function blocoOfereceCategoriaMobilidade(
  bloco: { categorias_mobilidade?: unknown } | null | undefined,
  categoria: string | null | undefined,
): boolean {
  const c = String(categoria ?? '').trim()
  return categoriasMobilidadeDoBloco(bloco).some((x) => x === c)
}
