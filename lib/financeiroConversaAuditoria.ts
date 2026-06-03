import type { SupabaseClient } from '@supabase/supabase-js'

export type AcaoLogFinanceiroConversa = 'acessado' | 'arquivado'

/** Handle @username do ADM para linhas de auditoria no campo `assunto`. */
export async function resolverHandleAdmFinanceiro(
  supabase: SupabaseClient,
  admUsuarioId: string,
): Promise<string> {
  const uid = admUsuarioId.trim()
  if (!uid) return '@admin'

  const [{ data: prof }, { data: emp }, { data: tur }, { data: u }] = await Promise.all([
    supabase.from('profissionais').select('nome_usuario').eq('usuario_id', uid).maybeSingle(),
    supabase.from('empresas').select('nome_usuario').eq('usuario_id', uid).maybeSingle(),
    supabase.from('turistas').select('nome_usuario').eq('usuario_id', uid).maybeSingle(),
    supabase.from('usuarios').select('email').eq('id', uid).maybeSingle(),
  ])

  const nu =
    (prof?.nome_usuario != null ? String(prof.nome_usuario).trim() : '') ||
    (emp?.nome_usuario != null ? String(emp.nome_usuario).trim() : '') ||
    (tur?.nome_usuario != null ? String(tur.nome_usuario).trim() : '') ||
    (u?.email != null ? String(u.email).split('@')[0]?.trim() : '') ||
    'admin'

  return nu.startsWith('@') ? nu : `@${nu}`
}

export function linhaLogFinanceiroConversa(acao: AcaoLogFinanceiroConversa, handle: string): string {
  const h = handle.startsWith('@') ? handle : `@${handle}`
  return acao === 'arquivado' ? `Arquivado por ${h}` : `Acessado por ${h}`
}

const RE_LINHA_AUDITORIA = /^(Acessado por|Arquivado por)\s+@/i

/** Linhas de rastreamento ADM (acesso/arquivamento) gravadas no campo `assunto`. */
export function extrairLinhasAuditoriaAssunto(assunto: string | null | undefined): string[] {
  if (assunto == null || !String(assunto).trim()) return []
  return String(assunto)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => RE_LINHA_AUDITORIA.test(l))
}

/** Texto livre do assunto, sem linhas de auditoria. */
export function assuntoSemLinhasAuditoria(assunto: string | null | undefined): string | null {
  if (assunto == null || !String(assunto).trim()) return null
  const rest = String(assunto)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !RE_LINHA_AUDITORIA.test(l))
  return rest.length ? rest.join('\n') : null
}

/** Linha única para exibição — prioriza arquivamento sobre acesso. */
export function extrairLinhaAuditoriaUnica(assunto: string | null | undefined): string | null {
  const linhas = extrairLinhasAuditoriaAssunto(assunto)
  const arquivado = linhas.find((l) => /^Arquivado por/i.test(l))
  if (arquivado) return arquivado
  const acessado = linhas.find((l) => /^Acessado por/i.test(l))
  return acessado ?? null
}

/** Substitui linhas de auditoria por uma única linha (mantém texto livre do assunto). */
export function definirLinhaAuditoriaUnicaAssunto(
  assuntoAtual: string | null | undefined,
  linhaAuditoria: string,
): string {
  const livre = assuntoSemLinhasAuditoria(assuntoAtual)
  const audit = linhaAuditoria.trim()
  if (!audit) return livre ?? ''
  return livre ? `${livre}\n${audit}` : audit
}

/** Grava uma única linha de auditoria no assunto (substitui «Acessado/Arquivado por …» anteriores). */
export async function substituirLogConversaFinanceiro(
  supabase: SupabaseClient,
  conversaId: string,
  linha: string,
): Promise<void> {
  const id = conversaId.trim()
  const nova = linha.trim()
  if (!id || !nova) return

  const { data } = await supabase.from('financeiro_conversas').select('assunto').eq('id', id).maybeSingle()
  const atual = data?.assunto != null ? String(data.assunto) : null
  const next = definirLinhaAuditoriaUnicaAssunto(atual, nova)
  await supabase.from('financeiro_conversas').update({ assunto: next || null }).eq('id', id)
}

/** @deprecated Preferir {@link substituirLogConversaFinanceiro} — mantido para compatibilidade interna. */
export async function appendAssuntoLogConversaFinanceiro(
  supabase: SupabaseClient,
  conversaId: string,
  linha: string,
): Promise<void> {
  await substituirLogConversaFinanceiro(supabase, conversaId, linha)
}

export async function registrarLogConversaFinanceiro(
  supabase: SupabaseClient,
  params: { conversaId: string; admUsuarioId: string; acao: AcaoLogFinanceiroConversa },
): Promise<void> {
  const handle = await resolverHandleAdmFinanceiro(supabase, params.admUsuarioId)
  const linha = linhaLogFinanceiroConversa(params.acao, handle)
  await substituirLogConversaFinanceiro(supabase, params.conversaId, linha)
}
