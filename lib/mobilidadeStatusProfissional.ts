import { normalizarCategoriasProfissional } from '@/lib/cartaoVisitaProfissional'

export type MobilidadeStatusId = 'offline' | 'online' | 'em_atendimento'

/** Categorias que usam o toggle de Mobilidade (sem motorista_app — demanda vai ao app parceiro). */
export const CATEGORIAS_MOBILIDADE_STATUS = [
  'van',
  'taxista',
  'guia',
] as const

export type CategoriaMobilidadeStatus = (typeof CATEGORIAS_MOBILIDADE_STATUS)[number]

export const COR_STATUS_MOBILIDADE: Record<MobilidadeStatusId, string> = {
  online: '#00D443',
  offline: '#E74C3C',
  em_atendimento: '#F1C40F',
}

/** 2 horas sem aceite → perguntar se ainda disponível. */
export const MOBILIDADE_ONLINE_IDLE_MS = 2 * 60 * 60 * 1000
/** 1 minuto sem resposta no popup → força offline. */
export const MOBILIDADE_IDLE_RESPOSTA_MS = 60 * 1000
/** Heartbeat de GPS enquanto online (alinha com poll da corrida no mapa). */
export const MOBILIDADE_HEARTBEAT_MS = 20_000

export function profissionalTemCategoriaMobilidade(
  categorias: string[] | null | undefined,
): boolean {
  const cats = normalizarCategoriasProfissional(categorias)
  return CATEGORIAS_MOBILIDADE_STATUS.some((c) => cats.includes(c))
}

/** Categorias elegíveis na busca Ecossistema (mobilidade — exclui anfitrião puro). */
export const CATEGORIAS_ECOSSISTEMA_MOBILIDADE = [
  'guia',
  'van',
  'taxista',
  'motorista_app',
] as const

export function profissionalElegivelBuscaEcossistema(
  categorias: string[] | null | undefined,
): boolean {
  const cats = normalizarCategoriasProfissional(categorias)
  return CATEGORIAS_ECOSSISTEMA_MOBILIDADE.some((c) => cats.includes(c))
}

export function parseMobilidadeStatus(raw: unknown): MobilidadeStatusId {
  const s = String(raw ?? '').trim().toLowerCase()
  if (s === 'online' || s === 'em_atendimento') return s
  return 'offline'
}

export type ProfissionalOnlineMapa = {
  id: string
  usuario_id: string
  nome_completo: string
  nome_usuario: string | null
  foto_url: string | null
  categorias: string[]
  placa_vermelha: boolean
  cidades_atuacao: string[]
  status: MobilidadeStatusId
  lat: number
  lng: number
}
