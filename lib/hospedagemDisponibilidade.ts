export type HospedagemDisponibilidade = 'livre' | 'lotado'

export const COR_QUARTOS_LIVRES = '#00D443'
export const COR_ESTAMOS_LOTADO = '#DC2626'
export const COR_AZUL_LOGO = '#0097b2'

export function normalizarDisponibilidadeHospedagem(
  raw: unknown,
): HospedagemDisponibilidade | null {
  const v = String(raw ?? '').trim()
  if (v === 'livre' || v === 'lotado') return v
  return null
}

export function empresaEhSegmentoHospedagem(empresa: {
  categoria?: string | null
  somente_anfitriao?: boolean | null
}): boolean {
  if (Boolean(empresa.somente_anfitriao)) return true
  return String(empresa.categoria ?? '').trim() === 'Hospedagem'
}

export function rotuloDisponibilidadeHospedagem(
  disponibilidade: HospedagemDisponibilidade | null,
): string {
  if (disponibilidade === 'lotado') return 'ESTAMOS LOTADO'
  return 'QUARTOS LIVRES'
}

export function corDisponibilidadeHospedagem(
  disponibilidade: HospedagemDisponibilidade | null,
): string {
  if (disponibilidade === 'lotado') return COR_ESTAMOS_LOTADO
  return COR_QUARTOS_LIVRES
}

/** Hospedagem com quartos disponíveis (não marcada como lotada). */
export function empresaHospedagemTemVagas(raw: unknown): boolean {
  return normalizarDisponibilidadeHospedagem(raw) !== 'lotado'
}
