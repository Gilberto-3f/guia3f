import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'

const TABELAS_RECOMENDACAO = [
  'recomendacoes',
  'recomendacoes_produto',
  'recomendacoes_prato',
  'recomendacoes_servico',
  'recomendacoes_ticket',
] as const

/**
 * Escuta INSERT de recomendações (empresa / produto / prato / serviço / ticket)
 * filtrado por empresa_id. Debounce no callback do caller.
 */
export function subscribeRecomendacoesEmpresa(
  client: SupabaseClient,
  empresaId: string,
  channelName: string,
  onInsert: () => void,
): RealtimeChannel {
  let ch = client.channel(channelName)
  for (const table of TABELAS_RECOMENDACAO) {
    ch = ch.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table,
        filter: `empresa_id=eq.${empresaId}`,
      },
      onInsert,
    )
  }
  return ch.subscribe()
}

export { TABELAS_RECOMENDACAO }
