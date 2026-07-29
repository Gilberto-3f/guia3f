/** Justificativas de recusa (placa vermelha / profissionais do app). */

export const JUSTIFICATIVAS_RECUSA_MOBILIDADE = [
  'ponto_fora_rota',
  'distancia_longa',
  'cliente_cancelou',
  'outro',
] as const

export type JustificativaRecusaMobilidadeId = (typeof JUSTIFICATIVAS_RECUSA_MOBILIDADE)[number]

export function isJustificativaRecusaMobilidade(raw: unknown): raw is JustificativaRecusaMobilidadeId {
  return JUSTIFICATIVAS_RECUSA_MOBILIDADE.includes(String(raw ?? '') as JustificativaRecusaMobilidadeId)
}
