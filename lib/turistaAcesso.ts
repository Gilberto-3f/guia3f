/**
 * Acesso do turista a compras, reservas e condicionais do Guia.
 */

export type UsuarioTuristaGate = {
  role?: string | null
  status?: string | null
  documentacao_validada_adm?: boolean | null
  turista_pre_liberado_ate?: string | null
}

export function turistaPreLiberacaoAtiva(ate: string | null | undefined): boolean {
  if (!ate) return false
  const t = new Date(ate).getTime()
  return Number.isFinite(t) && t > Date.now()
}

/** Conta liberada (ADM) ou pré-liberada (24h vigente). */
export function turistaRecursosLiberados(u: UsuarioTuristaGate | null | undefined): boolean {
  if (!u || String(u.role ?? '') !== 'turista') return true
  if (Boolean(u.documentacao_validada_adm)) return true
  if (turistaPreLiberacaoAtiva(u.turista_pre_liberado_ate)) return true
  return false
}

export function perfilTuristaComRestricao(u: UsuarioTuristaGate | null | undefined): boolean {
  if (!u || String(u.role ?? '') !== 'turista') return false
  return !turistaRecursosLiberados(u)
}
