import type { SupabaseClient } from '@supabase/supabase-js'

/** Seeds já existentes em public.infracoes (GestaoAdvertencias). */
export const INFRACAO_SEED = {
  profCancelUltimaHora: 'Cancelamento de última hora (<10min)',
  profAtraso: 'Atraso sem justificativa (até 15min)',
  turistaNoShow: 'Não comparecimento sem aviso',
} as const

export type InfracaoSeedKey = keyof typeof INFRACAO_SEED

async function buscarInfracaoId(
  admin: SupabaseClient,
  descricao: string,
  categoria: 'profissional' | 'turista',
): Promise<string | null> {
  const { data } = await admin
    .from('infracoes')
    .select('id, alerta_preventivo, horas_alerta')
    .eq('descricao', descricao)
    .eq('categoria', categoria)
    .maybeSingle()
  return data?.id != null ? String(data.id) : null
}

/**
 * Aplica alerta preventivo (RPC) para infração de mobilidade.
 * Não cria UI ADM — reusa catálogo e historico_decisoes.
 */
export async function registrarInfracaoMobilidade(
  admin: SupabaseClient,
  params: {
    usuarioId: string
    categoria: 'profissional' | 'turista'
    seed: InfracaoSeedKey
    solicitacaoId?: string | null
    detalhe?: string | null
  },
): Promise<{ ok: boolean; infracaoId?: string; historicoId?: string; error?: string }> {
  const descricao = INFRACAO_SEED[params.seed]
  const infracaoId = await buscarInfracaoId(admin, descricao, params.categoria)
  if (!infracaoId) {
    return { ok: false, error: `Infração não encontrada no catálogo: ${descricao}` }
  }

  const { data: rpcData, error: rpcErr } = await admin.rpc('aplicar_alerta_preventivo', {
    p_usuario_id: params.usuarioId,
    p_infracao_id: infracaoId,
  })

  if (rpcErr) {
    // se já existe alerta ativo, ainda registra nota no metadata path do caller
    return { ok: false, error: rpcErr.message, infracaoId }
  }

  const sucesso =
    rpcData && typeof rpcData === 'object' && (rpcData as { sucesso?: boolean }).sucesso === true

  if (params.solicitacaoId) {
    const { data: row } = await admin
      .from('solicitacao_mobilidade')
      .select('metadata')
      .eq('id', params.solicitacaoId)
      .maybeSingle()
    const meta =
      typeof row?.metadata === 'object' && row.metadata != null && !Array.isArray(row.metadata)
        ? { ...(row.metadata as Record<string, unknown>) }
        : {}
    const ids = Array.isArray(meta.infracao_ids) ? [...(meta.infracao_ids as string[])] : []
    if (!ids.includes(infracaoId)) ids.push(infracaoId)
    await admin
      .from('solicitacao_mobilidade')
      .update({
        metadata: {
          ...meta,
          infracao_ids: ids,
          ultima_infracao: {
            id: infracaoId,
            seed: params.seed,
            detalhe: params.detalhe ?? null,
            em: new Date().toISOString(),
            rpc_ok: sucesso,
          },
        },
      })
      .eq('id', params.solicitacaoId)
  }

  return { ok: true, infracaoId }
}

/** Cancela/atraso < 2h da partida → candidatos a infração. */
export function ehCancelamentoUltimaHora(dataAgendada: string | null | undefined, agora = Date.now()): boolean {
  if (!dataAgendada) return false
  const t = new Date(dataAgendada).getTime()
  if (!Number.isFinite(t)) return false
  const diff = t - agora
  return diff >= 0 && diff <= 2 * 60 * 60 * 1000
}
