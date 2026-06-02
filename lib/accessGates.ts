/**
 * Regras de acesso: janela 48h turista, profissional em modo turista, empresa no Guia.
 */

export type UsuarioGateRow = {
  role?: string | null
  status?: string | null
  documentacao_validada_adm?: boolean | null
  turista_janela_48h_inicio?: string | null
}

/** Profissional ainda não aprovado pelo ADM: UX como turista, sem recursos profissionais. */
export function profissionalEmModoTurista(u: UsuarioGateRow | null | undefined): boolean {
  if (!u || u.role == null) return false
  return String(u.role) === 'profissional' && String(u.status ?? '') !== 'ativo'
}

/** Turista após expirar 48h sem validação ADM: recursos que exigem documentação devem ser bloqueados. */
export function turistaComRestricaoPosJanela(u: UsuarioGateRow | null | undefined): boolean {
  if (!u || u.role == null) return false
  return String(u.role) === 'turista' && String(u.status ?? '') === 'pre_aprovado'
}

/** Empresa aparece nas listagens públicas do Guia. */
export function empresaPublicadaNoGuia(statusEmpresa: string | null | undefined): boolean {
  return String(statusEmpresa ?? '') === 'aprovado'
}

/** Conta empresa liberada para dashboard, publicidade, canal financeiro, etc. */
export function empresaContaOperacional(
  statusUsuario: string | null | undefined,
  statusEmpresa?: string | null,
  docsVerificado?: boolean | null,
): boolean {
  if (String(statusUsuario ?? '') !== 'ativo') return false
  if (statusEmpresa != null && String(statusEmpresa) !== 'aprovado') return false
  if (docsVerificado === false) return false
  return true
}
