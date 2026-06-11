import type { SupabaseClient } from '@supabase/supabase-js'
import { resolverHandleAdmFinanceiro } from '@/lib/financeiroConversaAuditoria'

export type LeituraCadastroAuditoriaRow = {
  id: string
  log_id: string
  admin_id: string
  admin_handle: string
  acessado_em: string
}

export const TIPOS_LOG_CADASTRO = ['turistas', 'profissionais', 'empresas'] as const
export type TipoLogCadastro = (typeof TIPOS_LOG_CADASTRO)[number]

export function isLogCadastroVerificacao(tipo: string | null | undefined): tipo is TipoLogCadastro {
  return TIPOS_LOG_CADASTRO.includes(tipo as TipoLogCadastro)
}

export async function listarLeiturasCadastroAuditoria(
  supabase: SupabaseClient,
  logId: string,
): Promise<LeituraCadastroAuditoriaRow[]> {
  const { data, error } = await supabase
    .from('logs_cadastro_auditoria_leitura')
    .select('id, log_id, admin_id, admin_handle, acessado_em')
    .eq('log_id', logId)
    .order('acessado_em', { ascending: false })

  if (error) throw error
  return (data ?? []) as LeituraCadastroAuditoriaRow[]
}

/** Registra acesso do ADM à verificação arquivada (append — histórico completo com data/hora). */
export async function registrarLeituraCadastroAuditoria(
  supabase: SupabaseClient,
  params: { logId: string; admUsuarioId: string },
): Promise<LeituraCadastroAuditoriaRow | null> {
  const logId = params.logId.trim()
  const admId = params.admUsuarioId.trim()
  if (!logId || !admId) return null

  const handle = await resolverHandleAdmFinanceiro(supabase, admId)

  const { data, error } = await supabase
    .from('logs_cadastro_auditoria_leitura')
    .insert({
      log_id: logId,
      admin_id: admId,
      admin_handle: handle,
    })
    .select('id, log_id, admin_id, admin_handle, acessado_em')
    .single()

  if (error) throw error
  return data as LeituraCadastroAuditoriaRow
}
