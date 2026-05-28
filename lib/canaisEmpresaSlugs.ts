/** Slugs de segmento comercial (canais globais onde o ADM publica avisos). */
export const SEGMENTOS_EMPRESA_SLUG = ['gastronomia', 'lojas', 'passeios', 'hospedagem'] as const

export type SegmentoEmpresaSlug = (typeof SEGMENTOS_EMPRESA_SLUG)[number]

const ROTULO_PARA_SLUG: Record<string, SegmentoEmpresaSlug> = {
  gastronomia: 'gastronomia',
  Gastronomia: 'gastronomia',
  Restaurantes: 'gastronomia',
  restaurantes: 'gastronomia',
  lojas: 'lojas',
  Lojas: 'lojas',
  passeios: 'passeios',
  Passeios: 'passeios',
  Atrativos: 'passeios',
  atrativos: 'passeios',
  hospedagem: 'hospedagem',
  Hospedagem: 'hospedagem',
}

export function categoriaEmpresaParaSlug(valor: string | null | undefined): string {
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

/** Slug do segmento a partir do canal global (Gastronomia, Lojas…). */
export function slugCanalSegmentoEmpresa(
  categoria: string | null | undefined,
  nome: string | null | undefined
): string | null {
  const cat = categoriaEmpresaParaSlug(categoria)
  if (cat && (SEGMENTOS_EMPRESA_SLUG as readonly string[]).includes(cat)) {
    return cat
  }

  const rawNome = String(nome ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (rawNome === 'gastronomia') return 'gastronomia'
  if (rawNome === 'lojas') return 'lojas'
  if (rawNome === 'passeios') return 'passeios'
  if (rawNome === 'hospedagem') return 'hospedagem'

  if ((SEGMENTOS_EMPRESA_SLUG as readonly string[]).includes(rawNome)) {
    return rawNome
  }
  return null
}

export function nomeNormCanalEmpresa(nome: string | null | undefined): string {
  return String(nome ?? '').trim().toUpperCase()
}

export function isCanalAdmEmpresaGlobal(canal: {
  nome?: string | null
  tipo_publico?: string | null
  categoria?: string | null
  empresa_id?: string | null
}): boolean {
  if (canal.tipo_publico !== 'empresa') return false
  if (canal.empresa_id != null) return false
  return nomeNormCanalEmpresa(canal.nome) === 'ADM'
}

export function isCanalFinanceiroEmpresa(nome: string | null | undefined): boolean {
  return nomeNormCanalEmpresa(nome) === 'FINANCEIRO'
}

/** Rótulo na lista e no cabeçalho do canal financeiro (usuário empresa). */
export const ROTULO_CANAL_FINANCEIRO_EMPRESA = 'Canal Financeiro da Empresa'
