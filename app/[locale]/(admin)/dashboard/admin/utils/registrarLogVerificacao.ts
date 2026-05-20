import { supabase } from '@/lib/supabase'

export type AdminAuditoriaContext = {
  id: string
  email: string
  admin_level: number
}

export type RegistrarLogVerificacaoInput = {
  tipo: string
  /** ID do alvo (perfil, denúncia, oferta de comissão, etc.) */
  perfil_id: string
  acao: string
  status_final: string
  admin: AdminAuditoriaContext
  detalhes?: Record<string, unknown>
  alvo_id?: string | null
}

/**
 * Registra ação de verificação/moderacao na tabela logs_verificacao (aba Auditoria).
 */
export async function registrarLogVerificacao(input: RegistrarLogVerificacaoInput): Promise<void> {
  const { error } = await supabase.from('logs_verificacao').insert({
    tipo: input.tipo,
    perfil_id: input.perfil_id,
    acao: input.acao,
    admin_id: input.admin.id,
    admin_email: input.admin.email,
    admin_nivel: input.admin.admin_level,
    alvo_id: input.alvo_id ?? null,
    detalhes: {
      status_final: input.status_final,
      ...(input.detalhes ?? {}),
    },
  })

  if (error) {
    console.error('[registrarLogVerificacao]', error.message, input)
  }
}

export function adminContextFromGate(admin: {
  id: string
  email?: string | null
  username?: string | null
  admin_level: number
}): AdminAuditoriaContext {
  return {
    id: admin.id,
    email: admin.email ?? admin.username ?? 'admin',
    admin_level: admin.admin_level,
  }
}

/** Extrai status final legível do registro de auditoria. */
export function statusFinalDoLog(log: { acao?: string; detalhes?: unknown }): string {
  const det = log.detalhes
  if (det && typeof det === 'object' && !Array.isArray(det) && 'status_final' in det) {
    const s = (det as { status_final?: unknown }).status_final
    if (s != null && String(s).trim()) return formatarStatusFinal(String(s))
  }
  return formatarStatusFinal(log.acao ?? '—')
}

export function formatarStatusFinal(raw: string): string {
  const map: Record<string, string> = {
    aprovado: 'Aprovado',
    aprovada: 'Aprovada',
    reprovado: 'Reprovado',
    reprovada: 'Reprovada',
    docs_verificado: 'Documentos verificados',
    denuncia_advertir: 'Denúncia — advertência',
    denuncia_suspender: 'Denúncia — suspensão',
    denuncia_banir: 'Denúncia — banimento',
    denuncia_em_investigacao: 'Denúncia — em investigação',
    denuncia_arquivada: 'Denúncia — arquivada',
    comissao_aprovada: 'Comissão — aprovada',
    comissao_reprovada: 'Comissão — reprovada',
  }
  const k = raw.toLowerCase().trim()
  if (map[k]) return map[k]
  if (k.includes('aprov')) return 'Aprovado'
  if (k.includes('reprov')) return 'Reprovado'
  return raw.replace(/_/g, ' ')
}
