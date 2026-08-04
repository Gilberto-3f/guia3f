/** Motivos de recusa — MVP (drawer de atendimento). */

export const JUSTIFICATIVAS_RECUSA_MOBILIDADE = [
  'em_atendimento',
  'fora_area_rota',
  'indisponivel_horario',
  'valor_condicoes',
  'outro',
] as const

export type JustificativaRecusaMobilidadeId = (typeof JUSTIFICATIVAS_RECUSA_MOBILIDADE)[number]

export function isJustificativaRecusaMobilidade(raw: unknown): raw is JustificativaRecusaMobilidadeId {
  return JUSTIFICATIVAS_RECUSA_MOBILIDADE.includes(String(raw ?? '') as JustificativaRecusaMobilidadeId)
}

/** "Outro" exige texto; demais ids bastam sozinhos. */
export function validarRecusaMobilidade(params: {
  justificativa: unknown
  detalhe?: unknown
}): { ok: true; id: JustificativaRecusaMobilidadeId; detalhe: string | null } | { ok: false; error: string } {
  const id = String(params.justificativa ?? '').trim()
  if (!isJustificativaRecusaMobilidade(id)) {
    return { ok: false, error: 'Selecione um motivo para recusar.' }
  }
  const detalhe = String(params.detalhe ?? '').trim()
  if (id === 'outro' && !detalhe) {
    return { ok: false, error: 'Descreva o motivo da recusa.' }
  }
  return { ok: true, id, detalhe: id === 'outro' ? detalhe : detalhe || null }
}
