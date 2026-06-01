import { Bus, Car, Compass, DollarSign, Home, Smartphone } from 'lucide-react'

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

/** Verde dos ícones da pasta Administração / Administradores do app. */
export const COR_VERDE_CANAL_ADMINISTRACAO = '#00D443'

/** Azul da logo (botões de ação inativos no canal financeiro ADM). */
export const COR_AZUL_LOGO_CANAL = '#0097b2'

/**
 * Rótulo legível da categoria/comunidade no card financeiro ADM.
 * @param {string | null | undefined} raw
 */
export function rotuloCategoriaCardFinanceiro(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  const porSlug = {
    motorista_app: 'Motorista de APP',
    guia: 'Guia de Turismo',
    van: 'Motorista de Van',
    taxista: 'Taxista',
    anfitriao: 'Anfitrião',
    gastronomia: 'Gastronomia',
    lojas: 'Lojas',
    passeios: 'Passeios',
    hospedagem: 'Hospedagem',
  }
  if (porSlug[s]) return porSlug[s]
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Pasta Administração / Administradores do app (verde do botão chamar corrida). */
export const CLASSE_AVATAR_CANAL_ADMINISTRACAO =
  'flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-[#00D443] text-white'

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

/** @deprecated Use `TITULO_CANAL_FINANCEIRO_PESSOAL` em `CanalFinanceiroListaRotulo`. */
export const ROTULO_CANAL_FINANCEIRO_PROFISSIONAL = 'Seu Canal Financeiro'

/**
 * Título da pasta do canal coletivo da categoria (ex.: "Canal dos Guias de Turismo").
 * @param {string | null | undefined} comunidadeOuSlug
 */
export function tituloPastaCanalColetivoProfissional(comunidadeOuSlug) {
  const cat = tituloCanalProfissionalLista(comunidadeOuSlug)
  if (!cat || cat === 'Profissionais') return 'Canal dos Profissionais'
  return `Canal dos ${cat}`
}

/**
 * Rótulo na lista — canal coletivo da categoria ou financeiro particular.
 * @param {{ categoria?: string | null; nome?: string | null; comunidade_prof?: string | null }} c
 * @param {(nome: string | null | undefined) => boolean} [isFinanceiro]
 */
export function rotuloCanalListaProfissional(c, isFinanceiro) {
  if (typeof isFinanceiro === 'function' && isFinanceiro(c.nome)) {
    return 'Seu Canal Financeiro'
  }
  const slug = chaveProfissionalCanal(c)
  if (slug) return tituloPastaCanalColetivoProfissional(slug)
  return String(c.nome ?? '').trim() || 'Canal'
}

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
/** Qualquer canal financeiro (nome FINANCEIRO na BD). */
export function canalNomeEhFinanceiro(nome) {
  return String(nome ?? '').trim().toUpperCase() === 'FINANCEIRO'
}

export function iconeCanalFinanceiro() {
  return DollarSign
}

export function iconeCanalProfissionalLista(c) {
  if (canalNomeEhFinanceiro(c.nome)) return DollarSign
  const slug = chaveProfissionalCanal(c)
  return iconeComunidadeProfissional(slug || c.comunidade_prof || c.categoria || c.nome)
}
