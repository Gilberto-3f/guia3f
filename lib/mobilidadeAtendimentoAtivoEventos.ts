/** Eventos da UI de atendimento ativo (drawer ↔ cards flutuantes). */

export const MOBILIDADE_ABRIR_DRAWER_ATIVO = 'mobilidade:abrir-drawer-ativo'
export const MOBILIDADE_CORRIDA_ATIVA = 'mobilidade:corrida-ativa'

export function pedirAbrirDrawerAtendimentoAtivo(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(MOBILIDADE_ABRIR_DRAWER_ATIVO))
}

export function avisarCorridaAtivaAtualizada(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(MOBILIDADE_CORRIDA_ATIVA))
}

/** Atendimento imediato (sem data_agendada) — escopo do floating pós-aceite. */
export function ehAtendimentoImediatoAtivo(params: {
  status: string | null | undefined
  data_agendada?: string | null
}): boolean {
  const st = String(params.status ?? '')
  if (!['aceita', 'a_caminho', 'no_local', 'em_viagem'].includes(st)) return false
  return !params.data_agendada
}
