import type { SupabaseClient } from '@supabase/supabase-js'
import { resolverHandleAdmFinanceiro } from '@/lib/financeiroConversaAuditoria'

export type LeituraDenunciaAuditoriaRow = {
  id: string
  denuncia_id: string
  admin_id: string
  admin_handle: string
  acessado_em: string
}

export async function listarLeiturasDenunciaAuditoria(
  supabase: SupabaseClient,
  denunciaId: string,
): Promise<LeituraDenunciaAuditoriaRow[]> {
  const { data, error } = await supabase
    .from('logs_denuncia_auditoria_leitura')
    .select('id, denuncia_id, admin_id, admin_handle, acessado_em')
    .eq('denuncia_id', denunciaId)
    .order('acessado_em', { ascending: false })

  if (error) throw error
  return (data ?? []) as LeituraDenunciaAuditoriaRow[]
}

export async function registrarLeituraDenunciaAuditoria(
  supabase: SupabaseClient,
  params: { denunciaId: string; admUsuarioId: string },
): Promise<LeituraDenunciaAuditoriaRow | null> {
  const denunciaId = params.denunciaId.trim()
  const admId = params.admUsuarioId.trim()
  if (!denunciaId || !admId) return null

  const handle = await resolverHandleAdmFinanceiro(supabase, admId)
  const { data, error } = await supabase
    .from('logs_denuncia_auditoria_leitura')
    .insert({ denuncia_id: denunciaId, admin_id: admId, admin_handle: handle })
    .select('id, denuncia_id, admin_id, admin_handle, acessado_em')
    .single()

  if (error) throw error
  return data as LeituraDenunciaAuditoriaRow
}
