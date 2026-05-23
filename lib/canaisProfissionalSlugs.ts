/** Slugs canônicos de comunidade profissional (alinhados a RLS e profissionais.categorias). */
export const CATEGORIAS_PROFISSIONAIS_SLUG = [
  'motorista_app',
  'van',
  'taxista',
  'guia',
  'anfitriao',
] as const

export type CategoriaProfissionalSlug = (typeof CATEGORIAS_PROFISSIONAIS_SLUG)[number]

/** Rótulos legados → slug. */
const ROTULO_PARA_SLUG: Record<string, CategoriaProfissionalSlug> = {
  'Motorista de App': 'motorista_app',
  'Motorista de Aplicativo': 'motorista_app',
  Guia: 'guia',
  'Guia de Turismo': 'guia',
  Taxista: 'taxista',
  Van: 'van',
  Anfitrião: 'anfitriao',
  Anfitriao: 'anfitriao',
}

/**
 * Normaliza rótulo/categoria do banco para slug.
 */
export function categoriaProfissionalParaSlug(valor: string | null | undefined): string {
  const raw = String(valor ?? '').trim()
  if (!raw) return ''
  const mapped = ROTULO_PARA_SLUG[raw]
  const base = mapped ?? raw.toLowerCase()
  return base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .trim()
}

/**
 * Slug a partir do nome do canal global de comunidade (ex.: "Guias" → guia).
 */
export function slugCanalComunidadeProfissional(
  categoria: string | null | undefined,
  nome: string | null | undefined
): string | null {
  const cat = categoriaProfissionalParaSlug(categoria)
  if (cat && (CATEGORIAS_PROFISSIONAIS_SLUG as readonly string[]).includes(cat)) {
    return cat
  }

  const rawNome = String(nome ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (rawNome === 'taxistas' || rawNome === 'taxis') return 'taxista'
  if (rawNome === 'guias') return 'guia'
  if (rawNome === 'vans') return 'van'
  if (rawNome === 'anfitrioes' || rawNome === 'anfitrião') return 'anfitriao'
  if (rawNome === 'motoristas_app' || rawNome === 'motoristas app') return 'motorista_app'

  if ((CATEGORIAS_PROFISSIONAIS_SLUG as readonly string[]).includes(rawNome)) {
    return rawNome
  }
  return null
}

export function nomeNormCanalProfissional(nome: string | null | undefined): string {
  return String(nome ?? '').trim().toUpperCase()
}

export function isCanalAdmProfissionalGlobal(canal: {
  nome?: string | null
  tipo_publico?: string | null
  categoria?: string | null
  empresa_id?: string | null
}): boolean {
  if (canal.tipo_publico !== 'profissional') return false
  if (canal.empresa_id != null) return false
  const n = nomeNormCanalProfissional(canal.nome)
  if (n === 'ADM') return true
  return String(canal.categoria ?? '').toLowerCase() === 'admin'
}

export function isCanalFinanceiroProfissional(nome: string | null | undefined): boolean {
  return nomeNormCanalProfissional(nome) === 'FINANCEIRO'
}
