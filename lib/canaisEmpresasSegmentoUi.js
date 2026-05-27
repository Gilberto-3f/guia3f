import { ShoppingBag, Star, Ticket, Utensils } from 'lucide-react'
import { CLASSE_AVATAR_CANAL_PROFISSIONAL } from '@/lib/canaisProfissionaisListaUi'

export { CLASSE_AVATAR_CANAL_PROFISSIONAL as CLASSE_AVATAR_CANAL_EMPRESA_SEGMENTO }

/** @type {readonly string[]} */
export const CHAVES_SEGMENTO_EMPRESA = ['Restaurantes', 'Atrativos', 'Lojas', 'Hospedagem']

/** @type {Record<string, string>} */
const SLUG_PARA_CHAVE = {
  gastronomia: 'Restaurantes',
  restaurantes: 'Restaurantes',
  passeios: 'Atrativos',
  atrativos: 'Atrativos',
  lojas: 'Lojas',
  hospedagem: 'Hospedagem',
}

/** @type {Record<string, string>} */
const ROTULO_PARA_CHAVE = {
  Restaurantes: 'Restaurantes',
  Atrativos: 'Atrativos',
  Lojas: 'Lojas',
  Hospedagem: 'Hospedagem',
  Gastronomia: 'Restaurantes',
  Passeios: 'Atrativos',
}

/** Rótulos na lista ADM (pasta EMPRESAS). */
export const ROTULO_SEGMENTO_EMPRESA_LISTA = {
  Restaurantes: 'Gastronomia / Restaurantes',
  Lojas: 'Lojas',
  Atrativos: 'Passeios / Atrativos',
  Hospedagem: 'Hospedagem',
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
}

/**
 * @param {{ categoria?: string | null; nome?: string | null; empresa_categoria?: string | null }} c
 */
export function iconeCanalSegmentoEmpresaLista(c) {
  const chave = chaveSegmentoEmpresaDeCanal(c)
  if (chave && ICONE_POR_CHAVE[chave]) return ICONE_POR_CHAVE[chave]
  return Utensils
}
