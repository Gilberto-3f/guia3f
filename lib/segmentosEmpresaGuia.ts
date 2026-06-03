/** Segmentos de comércio no guia (turismo + serviços locais). Fonte única para slugs e categorias DB. */

export const SEGMENTOS_EMPRESA_SLUG = [
  'gastronomia',
  'lojas',
  'passeios',
  'hospedagem',
  'servicos_locais',
] as const

export type SegmentoEmpresaSlug = (typeof SEGMENTOS_EMPRESA_SLUG)[number]

/** Valores em `empresas.categoria` (cadastro). */
export const CATEGORIAS_EMPRESA_DB = [
  'Restaurantes',
  'Atrativos',
  'Lojas',
  'Hospedagem',
  'Serviços Locais',
] as const

export type CategoriaEmpresaDb = (typeof CATEGORIAS_EMPRESA_DB)[number]

export const SLUG_PARA_CATEGORIA_DB: Record<string, CategoriaEmpresaDb> = {
  gastronomia: 'Restaurantes',
  passeios: 'Atrativos',
  lojas: 'Lojas',
  hospedagem: 'Hospedagem',
  servicos_locais: 'Serviços Locais',
}

export const CATEGORIA_DB_PARA_SLUG: Record<string, SegmentoEmpresaSlug> = {
  Restaurantes: 'gastronomia',
  Atrativos: 'passeios',
  Lojas: 'lojas',
  Hospedagem: 'hospedagem',
  'Serviços Locais': 'servicos_locais',
  'Servicos Locais': 'servicos_locais',
}

/** Nomes dos canais globais ADM (tabela `canais.nome`). */
export const NOMES_CANAL_SEGMENTO_EMPRESA = [
  'Gastronomia',
  'Lojas',
  'Atrativos',
  'Passeios',
  'Hospedagem',
  'Serviços Locais',
] as const

export function categoriaDbParaSlug(valor: string | null | undefined): SegmentoEmpresaSlug | '' {
  const raw = String(valor ?? '').trim()
  if (!raw) return ''
  const mapped = CATEGORIA_DB_PARA_SLUG[raw]
  if (mapped) return mapped
  const norm = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '_')
  if ((SEGMENTOS_EMPRESA_SLUG as readonly string[]).includes(norm)) {
    return norm as SegmentoEmpresaSlug
  }
  return ''
}

export function slugGuiaParaCategoriaDb(slug: string | null | undefined): string {
  const s = String(slug ?? '').trim()
  return SLUG_PARA_CATEGORIA_DB[s] ?? s
}

export function ehCategoriaEmpresaPermitida(valor: string | null | undefined): boolean {
  return (CATEGORIAS_EMPRESA_DB as readonly string[]).includes(String(valor ?? '').trim() as CategoriaEmpresaDb)
}
