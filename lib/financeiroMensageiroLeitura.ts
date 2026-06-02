import type { SupabaseClient } from '@supabase/supabase-js'
import { calcularVistoEmAposLeitura } from '@/lib/canalBadge'

/**
 * Mensagens do mensageiro ADM (tabela `financeiro_mensagens`) não lidas pelo alvo.
 */
export async function contarMensageiroFinanceiroNaoLidas(
  supabase: SupabaseClient,
  usuarioId: string,
): Promise<number> {
  if (!usuarioId) return 0

  const { data: conversas, error: convErr } = await supabase
    .from('financeiro_conversas')
    .select('id')
    .eq('alvo_usuario_id', usuarioId)
    .eq('iniciada_por_adm', true)

  if (convErr) {
    console.error('contarMensageiroFinanceiroNaoLidas conversas:', convErr)
    return 0
  }

  const convIds = (conversas ?? []).map((c) => String(c.id)).filter(Boolean)
  if (convIds.length === 0) return 0

  const [{ data: leituras }, { data: mensagens, error: msgErr }] = await Promise.all([
    supabase
      .from('financeiro_conversa_leitura')
      .select('conversa_id, visto_em')
      .eq('usuario_id', usuarioId)
      .in('conversa_id', convIds),
    supabase
      .from('financeiro_mensagens')
      .select('conversa_id, remetente_id, created_at')
      .in('conversa_id', convIds)
      .neq('remetente_id', usuarioId),
  ])

  if (msgErr) {
    console.error('contarMensageiroFinanceiroNaoLidas mensagens:', msgErr)
    return 0
  }

  const vistoPorConversa = new Map<string, number>()
  for (const row of leituras ?? []) {
    const cid = String(row.conversa_id)
    const t = new Date(String(row.visto_em ?? 0)).getTime()
    if (!Number.isNaN(t)) vistoPorConversa.set(cid, t)
  }

  let n = 0
  for (const row of mensagens ?? []) {
    const cid = row.conversa_id != null ? String(row.conversa_id) : ''
    if (!cid) continue

    const created = new Date(String(row.created_at ?? 0)).getTime()
    if (Number.isNaN(created)) continue

    const visto = vistoPorConversa.get(cid) ?? 0
    if (created > visto) n += 1
  }

  return n
}

async function buscarUltimaMensagemConversa(
  supabase: SupabaseClient,
  conversaId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('financeiro_mensagens')
    .select('created_at')
    .eq('conversa_id', conversaId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data?.created_at != null ? String(data.created_at) : null
}

/** Marca conversa(s) do mensageiro financeiro como lidas pelo alvo. */
export async function marcarMensageiroFinanceiroLido(
  supabase: SupabaseClient,
  usuarioId: string,
  conversaId?: string | null,
): Promise<void> {
  if (!usuarioId) return

  let conversaIds: string[] = []

  if (conversaId) {
    conversaIds = [conversaId]
  } else {
    const { data: conversas } = await supabase
      .from('financeiro_conversas')
      .select('id')
      .eq('alvo_usuario_id', usuarioId)
      .eq('iniciada_por_adm', true)

    conversaIds = (conversas ?? []).map((c) => String(c.id)).filter(Boolean)
  }

  if (conversaIds.length === 0) return

  for (const cid of conversaIds) {
    const ultima = await buscarUltimaMensagemConversa(supabase, cid)
    const visto_em = calcularVistoEmAposLeitura(ultima)

    const { error } = await supabase.from('financeiro_conversa_leitura').upsert(
      {
        usuario_id: usuarioId,
        conversa_id: cid,
        visto_em,
      },
      { onConflict: 'usuario_id,conversa_id' },
    )

    if (error) console.error('marcarMensageiroFinanceiroLido:', error)
  }
}
