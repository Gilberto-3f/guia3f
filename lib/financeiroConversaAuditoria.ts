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

/** Acrescenta linha ao assunto (sem duplicar linha idêntica). */
export async function appendAssuntoLogConversaFinanceiro(
  supabase: SupabaseClient,
  conversaId: string,
  linha: string,
): Promise<void> {
  const id = conversaId.trim()
  const nova = linha.trim()
  if (!id || !nova) return

  const { data } = await supabase.from('financeiro_conversas').select('assunto').eq('id', id).maybeSingle()
  const atual = data?.assunto != null ? String(data.assunto).trim() : ''
  if (atual.split('\n').some((l) => l.trim() === nova)) return

  const next = atual ? `${atual}\n${nova}` : nova
  await supabase.from('financeiro_conversas').update({ assunto: next }).eq('id', id)
}

export async function registrarLogConversaFinanceiro(
  supabase: SupabaseClient,
  params: { conversaId: string; admUsuarioId: string; acao: AcaoLogFinanceiroConversa },
): Promise<void> {
  const handle = await resolverHandleAdmFinanceiro(supabase, params.admUsuarioId)
  const linha = linhaLogFinanceiroConversa(params.acao, handle)
  await appendAssuntoLogConversaFinanceiro(supabase, params.conversaId, linha)
}
