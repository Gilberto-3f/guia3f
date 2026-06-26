import type { SupabaseClient } from '@supabase/supabase-js'
import type { ServicoPlanoId } from '@/lib/planosEmpresaCatalogo'

export type StatusAuxiliarAdmSolicitacao = 'pendente' | 'atribuido' | 'cancelado'

export type AuxiliarAdmSolicitacaoRow = {
  id: string
  empresa_id: string
  assinatura_id: string | null
  status: StatusAuxiliarAdmSolicitacao
  moderador_usuario_id: string | null
  atribuido_em: string | null
  created_at: string
}

function planoTemAuxiliarAdm(servicosRaw: unknown): boolean {
  if (!Array.isArray(servicosRaw)) return false
  return servicosRaw.some((s) => String(s) === 'auxiliar_adm')
}

/** Cria solicitação pendente quando o plano contratado inclui auxiliar_adm. */
export async function registrarSolicitacaoAuxiliarAdmSeAplicavel(
  supabase: SupabaseClient,
  params: {
    empresaId: string
    assinaturaId: string
    planoServicos: unknown
  },
): Promise<void> {
  if (!planoTemAuxiliarAdm(params.planoServicos)) return

  const empresaId = params.empresaId.trim()
  const assinaturaId = params.assinaturaId.trim()
  if (!empresaId || !assinaturaId) return

  const agora = new Date().toISOString()

  const { data: existente } = await supabase
    .from('empresa_auxiliar_adm_solicitacoes')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('status', 'pendente')
    .limit(1)
    .maybeSingle()

  if (existente?.id) return

  await supabase.from('empresa_auxiliar_adm_solicitacoes').insert({
    empresa_id: empresaId,
    assinatura_id: assinaturaId,
    status: 'pendente',
    updated_at: agora,
  })
}

export async function buscarSolicitacaoAuxiliarAdmEmpresa(
  supabase: SupabaseClient,
  empresaId: string,
): Promise<AuxiliarAdmSolicitacaoRow | null> {
  const { data } = await supabase
    .from('empresa_auxiliar_adm_solicitacoes')
    .select('id, empresa_id, assinatura_id, status, moderador_usuario_id, atribuido_em, created_at')
    .eq('empresa_id', empresaId)
    .in('status', ['pendente', 'atribuido'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data?.id) return null
  return {
    id: String(data.id),
    empresa_id: String(data.empresa_id),
    assinatura_id: data.assinatura_id != null ? String(data.assinatura_id) : null,
    status: String(data.status) as StatusAuxiliarAdmSolicitacao,
    moderador_usuario_id:
      data.moderador_usuario_id != null ? String(data.moderador_usuario_id) : null,
    atribuido_em: data.atribuido_em != null ? String(data.atribuido_em) : null,
    created_at: String(data.created_at ?? ''),
  }
}

export function servicosPlanoIncluem(
  servicosRaw: unknown,
  servico: ServicoPlanoId,
): boolean {
  if (!Array.isArray(servicosRaw)) return false
  return servicosRaw.some((s) => String(s) === servico)
}
