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

/** Reabre (ou cria) o chat temporário para item esquecido após a corrida. */
export async function reabrirOuObterConversaItemEsquecido(
  admin: SupabaseClient,
  params: {
    solicitacaoId: string
    turistaUsuarioId: string
    profissionalUsuarioId: string
  },
): Promise<{ conversaId: string; status: string } | { error: string }> {
  const { data: existente } = await admin
    .from('mobilidade_conversas')
    .select('id, status')
    .eq('solicitacao_id', params.solicitacaoId)
    .maybeSingle()

  if (existente?.id) {
    if (String(existente.status) !== 'aberta') {
      const { error } = await admin
        .from('mobilidade_conversas')
        .update({ status: 'aberta', encerrada_em: null })
        .eq('id', existente.id)
      if (error) return { error: error.message }
    }
    return { conversaId: String(existente.id), status: 'aberta' }
  }

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
    return { error: error?.message ?? 'Falha ao abrir chat de item esquecido.' }
  }
  return { conversaId: String(nova.id), status: 'aberta' }
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

export async function encerrarConversaPorId(
  admin: SupabaseClient,
  conversaId: string,
): Promise<{ ok: true } | { error: string }> {
  const { error } = await admin
    .from('mobilidade_conversas')
    .update({ status: 'encerrada', encerrada_em: new Date().toISOString() })
    .eq('id', conversaId)
    .eq('status', 'aberta')
  if (error) return { error: error.message }
  return { ok: true }
}

export async function obterConversaPorSolicitacao(
  admin: SupabaseClient,
  solicitacaoId: string,
): Promise<{ conversaId: string; status: string } | null> {
  const { data } = await admin
    .from('mobilidade_conversas')
    .select('id, status')
    .eq('solicitacao_id', solicitacaoId)
    .maybeSingle()
  if (!data?.id) return null
  return { conversaId: String(data.id), status: String(data.status ?? 'encerrada') }
}
