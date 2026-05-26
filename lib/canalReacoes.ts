import type { SupabaseClient } from '@supabase/supabase-js'

export type ReacaoCanal = {
  usuario_id: string
  tipo: string
}

/**
 * Normaliza `reacoes` (JSONB) vindo do Postgres/Supabase.
 */
export function parseReacoesCanal(raw: unknown): ReacaoCanal[] {
  if (raw == null) return []

  let value: unknown = raw
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw)
    } catch {
      return []
    }
  }

  if (!Array.isArray(value)) return []

  const out: ReacaoCanal[] = []
  for (const item of value) {
    if (item == null || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const usuario_id = row.usuario_id != null ? String(row.usuario_id) : ''
    const tipo = row.tipo != null ? String(row.tipo) : ''
    if (!usuario_id || !tipo) continue
    out.push({ usuario_id, tipo })
  }
  return out
}

/**
 * Alterna reação (emoji) numa mensagem via RPC (`toggle_reacao_mensagem_canal`).
 * Persiste no JSONB `mensagens_canal.reacoes` e fica visível a todos no canal.
 */
export async function toggleReacaoMensagemCanal(
  supabase: SupabaseClient,
  mensagemId: string,
  emoji: string,
): Promise<ReacaoCanal[]> {
  const { data, error } = await supabase.rpc('toggle_reacao_mensagem_canal', {
    p_mensagem_id: mensagemId,
    p_emoji: emoji,
  })

  if (error) {
    const code = typeof error === 'object' && error != null && 'code' in error ? String(error.code) : ''
    if (code === 'PGRST202') {
      return toggleReacaoMensagemCanalFallback(supabase, mensagemId, emoji)
    }
    throw error
  }

  if (data != null && typeof data === 'object' && 'reacoes' in data) {
    return parseReacoesCanal((data as { reacoes: unknown }).reacoes)
  }

  return parseReacoesCanal(data)
}

async function toggleReacaoMensagemCanalFallback(
  supabase: SupabaseClient,
  mensagemId: string,
  emoji: string,
): Promise<ReacaoCanal[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const uid = session?.user?.id
  if (!uid) throw new Error('not_authenticated')

  const { data: rowAtual, error: readErr } = await supabase
    .from('mensagens_canal')
    .select('reacoes')
    .eq('id', mensagemId)
    .maybeSingle()

  if (readErr) throw readErr
  if (!rowAtual) throw new Error('mensagem_nao_encontrada')

  const reacoes = parseReacoesCanal(rowAtual.reacoes)
  const jaReagiu = reacoes.some((r) => r.usuario_id === uid && r.tipo === emoji)
  const novasReacoes = jaReagiu
    ? reacoes.filter((r) => !(r.usuario_id === uid && r.tipo === emoji))
    : [...reacoes, { usuario_id: uid, tipo: emoji }]

  const { data: atualizado, error: updErr } = await supabase
    .from('mensagens_canal')
    .update({ reacoes: novasReacoes })
    .eq('id', mensagemId)
    .select('reacoes')
    .maybeSingle()

  if (updErr) throw updErr
  if (!atualizado) throw new Error('sem_permissao')

  return parseReacoesCanal(atualizado.reacoes)
}
