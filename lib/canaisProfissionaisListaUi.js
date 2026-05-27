import { Bus, Car, Compass, Home, Smartphone } from 'lucide-react'

/** @type {readonly string[]} */
export const COMUNIDADES_PROFISSIONAIS_SLUG = ['guia', 'taxista', 'van', 'motorista_app', 'anfitriao']

/** @type {Record<string, string>} */
const COMUNIDADE_TO_SLUG = {
  'Motorista de App': 'motorista_app',
  'Motorista de Aplicativo': 'motorista_app',
  'Guia de Turismo': 'guia',
  Guia: 'guia',
  Taxista: 'taxista',
  Van: 'van',
  Anfitrião: 'anfitriao',
  Anfitriao: 'anfitriao',
  motorista_app: 'motorista_app',
  guia: 'guia',
  taxista: 'taxista',
  van: 'van',
  anfitriao: 'anfitriao',
}

/** Classe do quadrado do ícone (azul logo + ícone branco). */
export const CLASSE_AVATAR_CANAL_PROFISSIONAL =
  'flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-[#0097b2] text-white'

/**
 * @param {string | null | undefined} valor
 */
export function toSlugComunidadeProf(valor) {
  const raw = String(valor ?? '').trim()
  if (!raw) return ''
  const mapped = COMUNIDADE_TO_SLUG[raw]
  const base = mapped ?? raw.toLowerCase()
  return base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .trim()
}

/**
 * Chave estável da comunidade profissional (slug) a partir do canal.
 * @param {{ categoria?: string | null; nome?: string | null; comunidade_prof?: string | null }} c
 */
export function chaveProfissionalCanal(c) {
  const fromComu = toSlugComunidadeProf(c.comunidade_prof)
  if (fromComu && COMUNIDADES_PROFISSIONAIS_SLUG.includes(fromComu)) return fromComu

  const cat = (c.categoria ?? '').trim().toLowerCase()
  if (cat && COMUNIDADES_PROFISSIONAIS_SLUG.includes(cat)) return cat

  const rawNome = (c.nome ?? '').trim().toLowerCase()
  if (!rawNome) return ''

  const nome = rawNome.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  if (nome === 'taxistas') return 'taxista'
  if (nome === 'guias') return 'guia'
  if (nome === 'vans') return 'van'
  if (nome === 'anfitrioes') return 'anfitriao'
  if (nome === 'motoristas_app' || nome === 'motoristas app') return 'motorista_app'

  if (COMUNIDADES_PROFISSIONAIS_SLUG.includes(nome)) return nome
  return ''
}

/**
 * Rótulo visível na lista / cabeçalho (não altera slug nem rotas).
 * @param {string | null | undefined} comunidadeOuSlug
 */
export function tituloCanalProfissionalLista(comunidadeOuSlug) {
  const slug = toSlugComunidadeProf(comunidadeOuSlug) || chaveProfissionalCanal({ nome: comunidadeOuSlug, categoria: comunidadeOuSlug })
  const porSlug = {
    motorista_app: 'Motoristas de APP',
    guia: 'Guias de Turismo',
    van: 'Motoristas de Van',
    taxista: 'Taxistas',
    anfitriao: 'Anfitriões',
  }
  if (slug && porSlug[slug]) return porSlug[slug]
  const c = String(comunidadeOuSlug ?? '').trim()
  return c || 'Profissionais'
}

/** @deprecated Use `tituloCanalProfissionalLista` — alias mantido para imports existentes. */
export const tituloCanalEmpresaLista = tituloCanalProfissionalLista

/**
 * Ícone Lucide por comunidade profissional.
 * @param {string | null | undefined} comunidadeOuSlug
 */
export function iconeComunidadeProfissional(comunidadeOuSlug) {
  const slug = toSlugComunidadeProf(comunidadeOuSlug) || chaveProfissionalCanal({ nome: comunidadeOuSlug, categoria: comunidadeOuSlug })
  if (slug === 'motorista_app') return Smartphone
  if (slug === 'guia') return Compass
  if (slug === 'van') return Bus
  if (slug === 'taxista') return Car
  if (slug === 'anfitriao') return Home
  return Compass
}

/**
 * @param {{ categoria?: string | null; nome?: string | null; comunidade_prof?: string | null }} c
 */
export function rotuloCanalProfissionalLista(c) {
  const slug = chaveProfissionalCanal(c)
  if (slug) return tituloCanalProfissionalLista(slug)
  return String(c.nome ?? '').trim() || 'Profissionais'
}

/**
 * @param {{ categoria?: string | null; nome?: string | null; comunidade_prof?: string | null }} c
 */
export function iconeCanalProfissionalLista(c) {
  const slug = chaveProfissionalCanal(c)
  return iconeComunidadeProfissional(slug || c.comunidade_prof || c.categoria || c.nome)
}
