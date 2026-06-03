import { ShoppingBag, Star, Ticket, Utensils, Wrench } from 'lucide-react'
import { categoriaEmpresaParaSlug } from '@/lib/canaisEmpresaSlugs'
import { CLASSE_AVATAR_CANAL_PROFISSIONAL } from '@/lib/canaisProfissionaisListaUi'

export { CLASSE_AVATAR_CANAL_PROFISSIONAL as CLASSE_AVATAR_CANAL_EMPRESA_SEGMENTO }

/** @type {readonly string[]} */
export const CHAVES_SEGMENTO_EMPRESA = ['Restaurantes', 'Atrativos', 'Lojas', 'Hospedagem', 'Serviços Locais']

/** @type {Record<string, string>} */
const SLUG_PARA_CHAVE = {
  gastronomia: 'Restaurantes',
  restaurantes: 'Restaurantes',
  passeios: 'Atrativos',
  atrativos: 'Atrativos',
  lojas: 'Lojas',
  hospedagem: 'Hospedagem',
  servicos_locais: 'Serviços Locais',
}

/** @type {Record<string, string>} */
const ROTULO_PARA_CHAVE = {
  Restaurantes: 'Restaurantes',
  Atrativos: 'Atrativos',
  Lojas: 'Lojas',
  Hospedagem: 'Hospedagem',
  Gastronomia: 'Restaurantes',
  Passeios: 'Atrativos',
  'Serviços Locais': 'Serviços Locais',
  'Servicos Locais': 'Serviços Locais',
}

/** Rótulos na lista ADM (pasta EMPRESAS). */
export const ROTULO_SEGMENTO_EMPRESA_LISTA = {
  Restaurantes: 'Gastronomia / Restaurantes',
  Lojas: 'Lojas',
  Atrativos: 'Passeios / Atrativos',
  Hospedagem: 'Hospedagem',
  'Serviços Locais': 'Serviços Locais',
}

/** Rótulos na pasta ADMINISTRAÇÃO (usuário empresa). */
export const ROTULO_CANAL_SEGMENTO_EMPRESA = {
  Restaurantes: 'Canal GASTRONOMIA',
  Atrativos: 'Canal ATRATIVOS',
  Lojas: 'Canal LOJAS',
  Hospedagem: 'Canal HOSPEDAGEM',
  'Serviços Locais': 'Canal SERVIÇOS LOCAIS',
}

/**
 * Chave de segmento a partir da categoria cadastrada da empresa.
 * @param {string | null | undefined} categoriaEmpresa
 */
export function chaveSegmentoPorCategoriaEmpresa(categoriaEmpresa) {
  const slug = categoriaEmpresaParaSlug(categoriaEmpresa)
  if (!slug) return null
  if (slug === 'gastronomia') return 'Restaurantes'
  if (slug === 'passeios') return 'Atrativos'
  if (slug === 'lojas') return 'Lojas'
  if (slug === 'hospedagem') return 'Hospedagem'
  if (slug === 'servicos_locais') return 'Serviços Locais'
  return chaveSegmentoEmpresaCanal(categoriaEmpresa)
}

/**
 * @param {string | null | undefined} categoriaEmpresa
 */
export function rotuloCanalSegmentoPorCategoriaEmpresa(categoriaEmpresa) {
  const chave = chaveSegmentoPorCategoriaEmpresa(categoriaEmpresa)
  if (chave && ROTULO_CANAL_SEGMENTO_EMPRESA[chave]) return ROTULO_CANAL_SEGMENTO_EMPRESA[chave]
  return 'Canal'
}

/**
 * @param {{ categoria?: string | null; nome?: string | null; empresa_categoria?: string | null }} c
 */
export function rotuloCanalSegmentoEmpresaParaEmpresa(c) {
  const chave = chaveSegmentoEmpresaDeCanal(c)
  if (chave && ROTULO_CANAL_SEGMENTO_EMPRESA[chave]) return ROTULO_CANAL_SEGMENTO_EMPRESA[chave]
  return String(c.nome ?? '').trim() || 'Canal'
}

/** Canal global de segmento (não ADM / Financeiro). */
export function ehCanalSegmentoEmpresaGlobal(c) {
  const n = String(c.nome ?? '')
    .trim()
    .toUpperCase()
  if (n === 'ADM' || n === 'FINANCEIRO') return false
  return chaveSegmentoEmpresaDeCanal(c) != null
}

/**
 * @param {string | null | undefined} valor
 */
function toSlug(valor) {
  const raw = String(valor ?? '').trim()
  if (!raw) return ''
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .trim()
}

/**
 * @param {string | null | undefined} valor
 * @returns {keyof typeof ROTULO_SEGMENTO_EMPRESA_LISTA | null}
 */
export function chaveSegmentoEmpresaCanal(valor) {
  const raw = String(valor ?? '').trim()
  if (!raw) return null
  if (ROTULO_PARA_CHAVE[raw]) return ROTULO_PARA_CHAVE[raw]
  const slug = toSlug(raw)
  if (slug && SLUG_PARA_CHAVE[slug]) return SLUG_PARA_CHAVE[slug]
  const rawLower = raw.toLowerCase()
  if (ROTULO_PARA_CHAVE[rawLower]) return ROTULO_PARA_CHAVE[rawLower]
  return null
}

/**
 * @param {{ categoria?: string | null; nome?: string | null; empresa_categoria?: string | null }} c
 */
export function chaveSegmentoEmpresaDeCanal(c) {
  for (const campo of [c.empresa_categoria, c.categoria, c.nome]) {
    const chave = chaveSegmentoEmpresaCanal(campo)
    if (chave) return chave
  }
  return null
}

/**
 * @param {{ categoria?: string | null; nome?: string | null; empresa_categoria?: string | null }} c
 */
export function rotuloCanalSegmentoEmpresaLista(c) {
  const chave = chaveSegmentoEmpresaDeCanal(c)
  if (chave && ROTULO_SEGMENTO_EMPRESA_LISTA[chave]) return ROTULO_SEGMENTO_EMPRESA_LISTA[chave]
  return String(c.nome ?? '').trim() || 'Empresas'
}

function IconHospedagemEstrela({ className, 'aria-hidden': ariaHidden = true }) {
  return (
    <Star
      className={className}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1}
      aria-hidden={ariaHidden}
    />
  )
}
IconHospedagemEstrela.displayName = 'IconHospedagemEstrela'

/** @type {Record<string, import('lucide-react').LucideIcon | typeof IconHospedagemEstrela>} */
const ICONE_POR_CHAVE = {
  Restaurantes: Utensils,
  Atrativos: Ticket,
  Lojas: ShoppingBag,
  Hospedagem: IconHospedagemEstrela,
  'Serviços Locais': Wrench,
}

/**
 * @param {{ categoria?: string | null; nome?: string | null; empresa_categoria?: string | null }} c
 */
export function iconeCanalSegmentoEmpresaLista(c) {
  const chave = chaveSegmentoEmpresaDeCanal(c)
  if (chave && ICONE_POR_CHAVE[chave]) return ICONE_POR_CHAVE[chave]
  return Utensils
}
