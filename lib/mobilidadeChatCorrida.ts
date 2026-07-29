import type { SupabaseClient } from '@supabase/supabase-js'

export async function abrirOuObterConversaCorrida(
  admin: SupabaseClient,
  params: {
    solicitacaoId: string
    turistaUsuarioId: string
    profissionalUsuarioId: string
  },
): Promise<{ conversaId: string } | { error: string }> {
  const { data: existente } = await admin
    .from('mobilidade_conversas')
    .select('id')
    .eq('solicitacao_id', params.solicitacaoId)
    .maybeSingle()

  if (existente?.id) return { conversaId: String(existente.id) }

  const { data: nova, error } = await admin
    .from('mobilidade_conversas')
    .insert({
      solicitacao_id: params.solicitacaoId,
      turista_usuario_id: params.turistaUsuarioId,
      profissional_usuario_id: params.profissionalUsuarioId,
      status: 'aberta',
    })
    .select('id')
    .maybeSingle()

  if (error || !nova?.id) {
    return { error: error?.message ?? 'Falha ao abrir chat da corrida.' }
  }
  return { conversaId: String(nova.id) }
}

export async function encerrarConversaCorrida(
  admin: SupabaseClient,
  solicitacaoId: string,
): Promise<void> {
  await admin
    .from('mobilidade_conversas')
    .update({ status: 'encerrada', encerrada_em: new Date().toISOString() })
    .eq('solicitacao_id', solicitacaoId)
    .eq('status', 'aberta')
}
