import type { SupabaseClient } from '@supabase/supabase-js'

export const LIMITE_MENSAGENS_CANAL_PADRAO = 80

const COLUNAS_MENSAGEM =
  'id, texto, anexo_url, anexo_tipo, reacoes, created_at, remetente_id, pais, canal_id'

/**
 * Últimas N mensagens do canal, em ordem cronológica (antigas → recentes) para exibição no chat.
 */
export async function listarMensagensCanalRecentes(
  supabase: SupabaseClient,
  canalId: string,
  opts?: { paisTab?: string; limit?: number },
): Promise<Record<string, unknown>[]> {
  const limit = opts?.limit ?? LIMITE_MENSAGENS_CANAL_PADRAO
  let q = supabase.from('mensagens_canal').select(COLUNAS_MENSAGEM).eq('canal_id', canalId)

  const paisTab = opts?.paisTab
  if (paisTab && paisTab !== 'geral') {
    q = q.or(`pais.eq.${paisTab},pais.eq.geral`)
  }

  const { data, error } = await q.order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return [...(data ?? [])].reverse()
}

/** Ordena linhas de mensagem por `created_at` ascendente. */
export function ordenarMensagensCanalCronologico<T extends { created_at?: string | null }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) => new Date(String(a.created_at ?? 0)).getTime() - new Date(String(b.created_at ?? 0)).getTime(),
  )
}
