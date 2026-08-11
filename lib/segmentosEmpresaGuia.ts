/** Segmentos de comércio no guia (turismo + serviços locais). Fonte única para slugs e categorias DB. */

export const SEGMENTOS_EMPRESA_SLUG = [
  'gastronomia',
  'lojas',
  'passeios',
  'hospedagem',
  'servicos_locais',
] as const

export type SegmentoEmpresaSlug = (typeof SEGMENTOS_EMPRESA_SLUG)[number]

import { CATEGORIAS_EMPRESA_COMERCIAL, ehCategoriaEmpresaComercial } from '@/lib/anfitriaoDualMode'

/** Valores em `empresas.categoria` (cadastro comercial — sem Hospedagem). */
export const CATEGORIAS_EMPRESA_DB = [...CATEGORIAS_EMPRESA_COMERCIAL] as const

export type CategoriaEmpresaDb = (typeof CATEGORIAS_EMPRESA_DB)[number]

/** Todas as categorias exibidas no guia (inclui Hospedagem de anfitriões). */
export const CATEGORIAS_GUIA_TODAS = [
  ...CATEGORIAS_EMPRESA_COMERCIAL,
  'Hospedagem',
] as const

export type CategoriaGuiaTodas = (typeof CATEGORIAS_GUIA_TODAS)[number]

export const SLUG_PARA_CATEGORIA_DB: Record<string, string> = {
  gastronomia: 'Restaurantes',
  passeios: 'Atrativos',
  atrativos: 'Atrativos',
  lojas: 'Lojas',
  hospedagem: 'Hospedagem',
  servicos_locais: 'Serviços Locais',
}

/** Filtro de país no cabeçalho da listagem do guia → cidade em `empresas.cidade`. */
export type PaisGuiaFiltro = 'br' | 'py' | 'ar'

export const CIDADE_POR_PAIS_GUIA: Record<PaisGuiaFiltro, string> = {
  br: 'Foz do Iguaçu',
  py: 'Ciudad del Este',
  ar: 'Puerto Iguazu',
}

/** Todas as grafias aceitas por cidade (cadastro legado, edição de perfil, guia). */
export const VARIANTES_CIDADE_GUIA: Record<string, readonly string[]> = {
  'foz do iguacu': ['Foz do Iguaçu', 'Foz do Iguacu'],
  'ciudad del este': [
    'Ciudad del Este',
    'Cidade do Leste',
    'CDE',
    'cde',
    'Ciudad Del Este',
  ],
  'puerto iguazu': ['Puerto Iguazu', 'Puerto Iguazú'],
  cde: ['Ciudad del Este', 'Cidade do Leste', 'CDE', 'cde'],
}

/** Título da página de filtros por slug da URL (GradeFiltros). */
export const TITULO_SLUG_GUIA: Record<string, string> = {
  gastronomia: 'Gastronomia',
  passeios: 'Atrativos',
  atrativos: 'Atrativos',
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

export function categoriaDbPorSlugGuia(slug: string | null | undefined): string {
  const s = String(slug ?? '').trim()
  return SLUG_PARA_CATEGORIA_DB[s] ?? slugGuiaParaCategoriaDb(s) ?? s
}

export function normalizarChaveCidadeGuia(cidade: string | null | undefined): string {
  return String(cidade ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function cidadeGuiaPorPais(pais: PaisGuiaFiltro): string {
  return CIDADE_POR_PAIS_GUIA[pais]
}

/** Cidade da empresa pertence ao filtro de país selecionado no guia. */
export function empresaCidadeCorrespondePaisGuia(
  cidadeEmpresa: string | null | undefined,
  pais: PaisGuiaFiltro,
): boolean {
  const alvo = aliasesCidadeGuia(cidadeGuiaPorPais(pais))
  const cidade = String(cidadeEmpresa ?? '').trim()
  return alvo.some((c) => c === cidade)
}

/** Categoria da empresa pertence ao segmento (slug) da página de filtros. */
export function empresaCategoriaCorrespondeSegmentoGuia(
  categoriaEmpresa: string | null | undefined,
  slugSegmento: string | null | undefined,
): boolean {
  const alvo = aliasesCategoriaDbGuia(categoriaDbPorSlugGuia(slugSegmento))
  const cat = String(categoriaEmpresa ?? '').trim()
  return alvo.some((c) => c === cat)
}

/** Valores equivalentes de `empresas.categoria` para busca no guia (cadastro legado + slugs). */
export function aliasesCategoriaDbGuia(categoriaOuSlug: string | null | undefined): string[] {
  const raw = String(categoriaOuSlug ?? '').trim()
  if (!raw) return []

  const canon = normalizarCategoriaEmpresaGuia(raw)
  const set = new Set<string>([raw])
  if (canon) set.add(canon)

  const slug = categoriaDbParaSlug(raw) || (SLUG_PARA_CATEGORIA_DB[raw] ? raw : '')
  if (slug) {
    set.add(slug)
    const db = SLUG_PARA_CATEGORIA_DB[slug]
    if (db) set.add(db)
  }

  if (canon === 'Atrativos' || raw === 'passeios' || raw === 'Passeios') {
    set.add('Atrativos')
    set.add('passeios')
    set.add('Passeios')
    set.add('atrativos')
  }
  if (canon === 'Restaurantes' || raw === 'gastronomia') {
    set.add('Restaurantes')
    set.add('gastronomia')
    set.add('Gastronomia')
  }
  if (canon === 'Lojas' || raw === 'lojas') {
    set.add('Lojas')
    set.add('lojas')
  }
  if (canon === 'Hospedagem' || raw === 'hospedagem') {
    set.add('Hospedagem')
    set.add('hospedagem')
  }
  if (canon === 'Serviços Locais' || raw === 'servicos_locais') {
    set.add('Serviços Locais')
    set.add('Servicos Locais')
    set.add('servicos_locais')
  }

  return [...set].filter(Boolean)
}

/** Valores equivalentes de `empresas.cidade` (cadastro sem acento vs guia com acento). */
export function aliasesCidadeGuia(cidade: string | null | undefined): string[] {
  const raw = String(cidade ?? '').trim()
  if (!raw) return []

  let norm = normalizarChaveCidadeGuia(raw)
  if (norm === 'cde' || norm === 'cidade do leste') {
    norm = 'ciudad del este'
  }
  const set = new Set<string>([raw])
  const variants = VARIANTES_CIDADE_GUIA[norm] ?? VARIANTES_CIDADE_GUIA[raw.toLowerCase()]
  if (variants) {
    for (const v of variants) set.add(v)
  }
  // Sempre inclui canônico CDE quando a chave resolve para Ciudad del Este
  if (norm === 'ciudad del este') {
    for (const v of VARIANTES_CIDADE_GUIA['ciudad del este']) set.add(v)
  }
  return [...set]
}

export function ehCategoriaEmpresaPermitida(valor: string | null | undefined): boolean {
  return ehCategoriaEmpresaComercial(valor)
}

/** Rótulos exibidos no guia turístico (canais / filtros). */
export const ROTULO_SEGUIMENTO_GUIA: Record<CategoriaGuiaTodas, string> = {
  Restaurantes: 'Gastronomia',
  Atrativos: 'Atrativos',
  Lojas: 'Lojas',
  Hospedagem: 'Hospedagem',
  'Serviços Locais': 'Serviços Locais',
}

const CORES_SEGUIMENTO_GUIA: Record<CategoriaGuiaTodas, string> = {
  Restaurantes: '#E74C3C',
  Atrativos: '#F1C40F',
  Lojas: '#9B59B6',
  Hospedagem: '#3498DB',
  'Serviços Locais': '#1ABC9C',
}

/** Mapeia valor legado ou slug para categoria do guia. */
export function normalizarCategoriaEmpresaGuia(valor: string | null | undefined): CategoriaGuiaTodas | null {
  const raw = String(valor ?? '').trim()
  if (!raw) return null
  if ((CATEGORIAS_GUIA_TODAS as readonly string[]).includes(raw)) return raw as CategoriaGuiaTodas
  const slug = categoriaDbParaSlug(raw)
  const mapped = slug ? SLUG_PARA_CATEGORIA_DB[slug] : null
  if (mapped && (CATEGORIAS_GUIA_TODAS as readonly string[]).includes(mapped)) {
    return mapped as CategoriaGuiaTodas
  }
  return null
}

export function agregarEmpresasPorSeguimentoGuia(
  rows: { categoria: string | null; somente_modo_apresentacao?: boolean | null }[],
): { label: string; valor: number; percentual: number; cor: string }[] {
  const porCategoria: Record<CategoriaGuiaTodas, number> = {
    Restaurantes: 0,
    Atrativos: 0,
    Lojas: 0,
    Hospedagem: 0,
    'Serviços Locais': 0,
  }

  for (const row of rows) {
    if (row.somente_modo_apresentacao) continue
    const cat = normalizarCategoriaEmpresaGuia(row.categoria)
    if (!cat) continue
    porCategoria[cat] += 1
  }

  const total = Object.values(porCategoria).reduce((a, b) => a + b, 0) || 1

  return CATEGORIAS_GUIA_TODAS.map((cat) => ({
    label: ROTULO_SEGUIMENTO_GUIA[cat],
    valor: porCategoria[cat],
    percentual: total > 0 ? (porCategoria[cat] / total) * 100 : 0,
    cor: CORES_SEGUIMENTO_GUIA[cat],
  }))
}
