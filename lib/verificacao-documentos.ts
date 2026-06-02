/** Regra única: recursos “modo profissional” só com cadastro ativo, perfil aprovado, docs conferidos e revisão em dia. */

export type LinhaProfissionalGate = {
  status?: string | null
  docs_verificado?: boolean | null
  proxima_revisao_docs_em?: string | null
}

export type LinhaEmpresaGate = {
  status?: string | null
  docs_verificado?: boolean | null
  aprovado_em?: string | null
  verificado_em?: string | null
}

export function profissionalRecursosLiberados(
  usuarioStatus: string | null | undefined,
  prof: LinhaProfissionalGate | null | undefined
): boolean {
  if (!prof) return false
  if (usuarioStatus !== 'ativo') return false
  if (String(prof.status ?? '') !== 'aprovado') return false
  if (!prof.docs_verificado) return false
  const pr = prof.proxima_revisao_docs_em
  if (pr) {
    const t = new Date(pr).getTime()
    if (!Number.isFinite(t) || t < Date.now()) return false
  }
  return true
}

/** Recursos da empresa (canal financeiro, menu operacional, etc.) só após ADM aprovar cadastro. */
export function empresaRecursosLiberados(
  usuarioStatus: string | null | undefined,
  emp: LinhaEmpresaGate | null | undefined,
): boolean {
  if (!emp) return false
  if (String(usuarioStatus ?? '') !== 'ativo') return false
  if (String(emp.status ?? '').toLowerCase() !== 'aprovado') return false
  if (emp.docs_verificado === true) return true
  // Aprovação legada ou snapshot sem docs_verificado sincronizado
  if (emp.aprovado_em || emp.verificado_em) return true
  return false
}

/** Dias até `proxima_revisao_docs_em` (negativo se vencido). Null se sem data. */
export function diasAteRevisaoDocumentos(proximaRevisaoIso: string | null | undefined): number | null {
  if (!proximaRevisaoIso) return null
  const alvo = new Date(proximaRevisaoIso)
  if (Number.isNaN(alvo.getTime())) return null
  const ms = alvo.getTime() - Date.now()
  return Math.ceil(ms / (24 * 60 * 60 * 1000))
}

/** Próxima data de revisão (+6 meses a partir de agora). */
export function proximaRevisaoDepoisDeAprovacao(): string {
  const d = new Date()
  d.setMonth(d.getMonth() + 6)
  return d.toISOString()
}
