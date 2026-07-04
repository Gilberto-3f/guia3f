import type { SupabaseClient } from '@supabase/supabase-js'

export type VisivelAvisoAdmHub = 'adm_geral' | 'adm_financeiro'

const VISIVEL_AVISO_ADM_HUB = new Set<VisivelAvisoAdmHub>(['adm_geral', 'adm_financeiro'])

/** Normaliza valores do banco para o union tipado. */
export function parseVisivelParaAvisoAdmHub(raw: unknown): VisivelAvisoAdmHub[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map(String)
    .filter((v): v is VisivelAvisoAdmHub => VISIVEL_AVISO_ADM_HUB.has(v as VisivelAvisoAdmHub))
}

export type FinanceiroAvisoAdmHubRow = {
  id: string
  tipo: string
  titulo: string
  mensagem: string
  visivel_para: VisivelAvisoAdmHub[]
  metadata: Record<string, unknown>
  lido_por: string[]
  created_at: string
}

export function adminPodeVerAvisosFinanceiroHub(admin: {
  admin_level?: number | null
  admin_permissoes?: unknown
} | null): boolean {
  if (!admin) return false
  const nivel = Number(admin.admin_level ?? 0)
  const cargo = (admin.admin_permissoes as { cargo?: string } | null)?.cargo
  return nivel === 1 || nivel === 3 || cargo === 'FINANCEIRO'
}

export function filtrarAvisosFinanceiroHubPorAdmin<T extends { visivel_para: string[] }>(
  avisos: T[],
  admin: { admin_level?: number | null; admin_permissoes?: unknown },
): T[] {
  const nivel = Number(admin.admin_level ?? 0)
  const cargo = (admin.admin_permissoes as { cargo?: string } | null)?.cargo
  const ehGeral = nivel === 1
  const ehFinanceiro = nivel === 3 || cargo === 'FINANCEIRO'

  return avisos.filter((a) => {
    const tags = Array.isArray(a.visivel_para) ? a.visivel_para : []
    if (ehGeral && tags.includes('adm_geral')) return true
    if (ehFinanceiro && tags.includes('adm_financeiro')) return true
    return false
  })
}

export function formatarDataCurtaAgendamento(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  } catch {
    return iso
  }
}

export function montarMensagemAgendamentoAssinaturaDinheiro(params: {
  empresaUsername: string
  visitaAgendadaEm: string
}): string {
  const username = params.empresaUsername.trim().replace(/^@/, '')
  const dataCurta = formatarDataCurtaAgendamento(params.visitaAgendadaEm)
  return `Agendamento - Nova empresa do guia turístico @${username || 'empresa'} agendou um trabalho para o dia ${dataCurta} (mais informações no ESPAÇO ADM).`
}

/**
 * Card informativo no Canal Financeiro ADM quando empresa agenda visita (pagamento em dinheiro).
 */
export async function inserirAvisoAgendamentoAssinaturaDinheiroHub(
  supabase: SupabaseClient,
  params: {
    assinaturaId: string
    empresaId: string
    empresaUsername: string
    visitaAgendadaEm: string
  },
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const mensagem = montarMensagemAgendamentoAssinaturaDinheiro({
    empresaUsername: params.empresaUsername,
    visitaAgendadaEm: params.visitaAgendadaEm,
  })

  const { data, error } = await supabase
    .from('financeiro_avisos_adm_hub')
    .insert({
      tipo: 'agendamento_assinatura_dinheiro',
      titulo: 'Agendamento',
      mensagem,
      visivel_para: ['adm_geral', 'adm_financeiro'],
      metadata: {
        assinatura_id: params.assinaturaId,
        empresa_id: params.empresaId,
        empresa_username: params.empresaUsername,
        visita_agendada_em: params.visitaAgendadaEm,
      },
    })
    .select('id')
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  return { ok: true, id: data?.id != null ? String(data.id) : undefined }
}
