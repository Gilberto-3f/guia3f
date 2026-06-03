import {
  SEGMENTOS_EMPRESA_SLUG,
  type SegmentoEmpresaSlug,
  categoriaDbParaSlug,
} from '@/lib/segmentosEmpresaGuia'

export { SEGMENTOS_EMPRESA_SLUG, type SegmentoEmpresaSlug }

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
  servicos_locais: 'servicos_locais',
  'Serviços Locais': 'servicos_locais',
  'Servicos Locais': 'servicos_locais',
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
  if (rawNome === 'servicos locais' || rawNome === 'serviços locais') return 'servicos_locais'

  const fromDb = categoriaDbParaSlug(categoria)
  if (fromDb) return fromDb

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

/** @deprecated Use `TITULO_CANAL_FINANCEIRO_PESSOAL` em `CanalFinanceiroListaRotulo`. */
export const ROTULO_CANAL_FINANCEIRO_EMPRESA = 'Seu Canal Financeiro'
