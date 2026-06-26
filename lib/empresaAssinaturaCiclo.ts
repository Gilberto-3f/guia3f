import type { SupabaseClient } from '@supabase/supabase-js'

export type ResultadoCicloAssinaturasEmpresa = {
  expiradas: number
  lembrete_5d: number
  lembrete_1d: number
}

function parseResultadoRpc(data: unknown): ResultadoCicloAssinaturasEmpresa {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { expiradas: 0, lembrete_5d: 0, lembrete_1d: 0 }
  }
  const row = data as Record<string, unknown>
  return {
    expiradas: Number(row.expiradas) || 0,
    lembrete_5d: Number(row.lembrete_5d) || 0,
    lembrete_1d: Number(row.lembrete_1d) || 0,
  }
}

/** Marca vencidas como inativas e envia lembretes D-5/D-1 (RPC ou fallback TS). */
export async function processarCicloAssinaturasEmpresa(
  supabase: SupabaseClient,
): Promise<ResultadoCicloAssinaturasEmpresa> {
  const { data, error } = await supabase.rpc('processar_ciclo_assinaturas_empresa')
  if (!error && data) return parseResultadoRpc(data)

  if (error) {
    console.warn('[empresaAssinaturaCiclo] RPC indisponível, fallback TS:', error.message)
  }

  return processarCicloAssinaturasEmpresaFallback(supabase)
}

async function processarCicloAssinaturasEmpresaFallback(
  supabase: SupabaseClient,
): Promise<ResultadoCicloAssinaturasEmpresa> {
  const agora = new Date()
  const agoraIso = agora.toISOString()
  let expiradas = 0
  let lembrete_5d = 0
  let lembrete_1d = 0

  const { data: expRows } = await supabase
    .from('empresa_assinaturas')
    .update({ status: 'inativo', updated_at: agoraIso })
    .eq('status', 'ativo')
    .not('vencimento_em', 'is', null)
    .lt('vencimento_em', agoraIso)
    .select('id')

  expiradas = expRows?.length ?? 0

  const { data: ativas } = await supabase
    .from('empresa_assinaturas')
    .select('id, empresa_id, plano_titulo, vencimento_em, lembrete_5d_enviado_em, lembrete_1d_enviado_em')
    .eq('status', 'ativo')
    .not('vencimento_em', 'is', null)
    .gte('vencimento_em', agoraIso)

  for (const row of ativas ?? []) {
    const venc = row.vencimento_em != null ? String(row.vencimento_em) : null
    if (!venc) continue

    const dias = Math.ceil((new Date(venc).getTime() - agora.getTime()) / (1000 * 60 * 60 * 24))
    const planoTitulo = String(row.plano_titulo ?? 'Plano')
    const empresaId = String(row.empresa_id)
    const assinaturaId = String(row.id)

    if (dias === 5 && row.lembrete_5d_enviado_em == null) {
      await supabase.from('canal_financeiro').insert({
        empresa_id: empresaId,
        profissional_id: null,
        tipo: 'lembrete_vencimento_plano',
        titulo: 'Plano vence em 5 dias',
        mensagem: `Seu plano ${planoTitulo} vence em 5 dias. Renove pelo canal Financeiro (aba Planos) para manter os serviços ativos.`,
        metadata: { variant: 'lembrete_5d', assinatura_id: assinaturaId, dias_restantes: 5 },
        comprovante_detalhes: { variant: 'lembrete_5d', assinatura_id: assinaturaId, dias_restantes: 5 },
        lida_por_empresa: false,
        lida_por_profissional: false,
      })
      await supabase
        .from('empresa_assinaturas')
        .update({ lembrete_5d_enviado_em: agoraIso, updated_at: agoraIso })
        .eq('id', assinaturaId)
      lembrete_5d += 1
    } else if (dias === 1 && row.lembrete_1d_enviado_em == null) {
      await supabase.from('canal_financeiro').insert({
        empresa_id: empresaId,
        profissional_id: null,
        tipo: 'lembrete_vencimento_plano',
        titulo: 'Plano vence amanhã — bloqueio iminente',
        mensagem: `Seu plano ${planoTitulo} vence amanhã. Sem renovação, os serviços do plano serão bloqueados ao fim do ciclo. Regularize o pagamento na aba Planos.`,
        metadata: { variant: 'lembrete_1d', assinatura_id: assinaturaId, dias_restantes: 1 },
        comprovante_detalhes: { variant: 'lembrete_1d', assinatura_id: assinaturaId, dias_restantes: 1 },
        lida_por_empresa: false,
        lida_por_profissional: false,
      })
      await supabase
        .from('empresa_assinaturas')
        .update({ lembrete_1d_enviado_em: agoraIso, updated_at: agoraIso })
        .eq('id', assinaturaId)
      lembrete_1d += 1
    }
  }

  return { expiradas, lembrete_5d, lembrete_1d }
}
