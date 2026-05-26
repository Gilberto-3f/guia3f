import type { SupabaseClient } from '@supabase/supabase-js'
import {
  contarFinanceiroNaoLidasProfissional,
  obterIdsCanaisMensagensProfissional,
} from '@/lib/canaisProfissionalVisibilidade'

/**
 * Marca o canal como lido para o utilizador (tabela `canal_leitura_profissional` — uso por qualquer role).
 */
export async function marcarCanalComoLido(
  supabase: SupabaseClient,
  usuarioId: string,
  canalId: string,
): Promise<void> {
  if (!usuarioId || !canalId) return
  const { error } = await supabase.from('canal_leitura_profissional').upsert(
    {
      usuario_id: usuarioId,
      canal_id: canalId,
      visto_em: new Date().toISOString(),
    },
    { onConflict: 'usuario_id,canal_id' },
  )
  if (error) console.error('marcarCanalComoLido:', error)
}

/**
 * Mensagens não lidas nos canais acessíveis: só de outros remetentes e posteriores a `visto_em`.
 * Não usa a tabela `atividades` — badge separado do coração (feed social).
 */
export async function contarMensagensNaoLidasCanais(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  if (!userId) return 0

  const { data: userRow } = await supabase.from('usuarios').select('role').eq('id', userId).maybeSingle()
  const role = userRow?.role != null ? String(userRow.role) : ''

  const desde = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString()

  /** Profissional: só canal da categoria + empresas da comunidade (+ financeiro via tabela própria). */
  let canalIdsPermitidos: Set<string> | null = null
  let extraFinanceiro = 0
  if (role === 'profissional') {
    canalIdsPermitidos = await obterIdsCanaisMensagensProfissional(supabase, userId)
    extraFinanceiro = await contarFinanceiroNaoLidasProfissional(supabase, userId)
  }

  const [{ data: mensagens, error: msgErr }, { data: leituras, error: leitErr }] = await Promise.all([
    supabase
      .from('mensagens_canal')
      .select('remetente_id, canal_id, created_at')
      .neq('remetente_id', userId)
      .gte('created_at', desde)
      .limit(2500),
    supabase.from('canal_leitura_profissional').select('canal_id, visto_em').eq('usuario_id', userId),
  ])

  if (msgErr) {
    console.error('contarMensagensNaoLidasCanais mensagens:', msgErr)
    return 0
  }
  if (leitErr) {
    console.error('contarMensagensNaoLidasCanais leituras:', leitErr)
  }

  const vistoPorCanal = new Map<string, number>()
  for (const row of leituras ?? []) {
    const cid = String(row.canal_id)
    const t = new Date(String(row.visto_em ?? 0)).getTime()
    if (!Number.isNaN(t)) vistoPorCanal.set(cid, t)
  }

  let n = 0
  for (const row of mensagens ?? []) {
    const rid = row.remetente_id != null ? String(row.remetente_id) : ''
    if (!rid || rid === userId) continue

    const cid = row.canal_id != null ? String(row.canal_id) : ''
    if (!cid) continue
    if (canalIdsPermitidos != null && !canalIdsPermitidos.has(cid)) continue

    const created = new Date(String(row.created_at ?? 0)).getTime()
    if (Number.isNaN(created)) continue

    const visto = vistoPorCanal.get(cid) ?? 0
    if (created > visto) n += 1
  }

  return n + extraFinanceiro
}
