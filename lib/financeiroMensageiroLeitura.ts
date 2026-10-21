import type { SupabaseClient } from '@supabase/supabase-js'
import { calcularVistoEmAposLeitura } from '@/lib/canalBadge'
import { vistoEmParaMs } from '@/lib/chatVisto'

/**
 * Mensagens do mensageiro ADM (tabela `financeiro_mensagens`) não lidas pelo alvo.
 */
export async function contarMensageiroFinanceiroNaoLidas(
  supabase: SupabaseClient,
  usuarioId: string,
  ecossistemaId?: string | null,
): Promise<number> {
  if (!usuarioId) return 0

  let convQ = supabase
    .from('financeiro_conversas')
    .select('id')
    .eq('alvo_usuario_id', usuarioId)
    .eq('iniciada_por_adm', true)
  const eco = ecossistemaId != null ? String(ecossistemaId).trim() : ''
  if (eco) convQ = convQ.eq('ecossistema_id', eco)
  const { data: conversas, error: convErr } = await convQ

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

export function mesclarBadgeFinanceiroLista(
  contagens: Record<string, number>,
  canais: Array<{ id: string; nome?: string | null; ecossistema_id?: string | null }>,
  isFinanceiro: (nome: string | null | undefined) => boolean,
  totalGlobal: number,
  msgPorEco: Map<string, number>,
  padraoId: string | null,
): Record<string, number> {
  const financeiros = canais.filter((c) => isFinanceiro(c.nome))
  if (financeiros.length === 0) return contagens
  let totalMsg = 0
  for (const n of msgPorEco.values()) totalMsg += n
  const relatorios = Math.max(0, totalGlobal - totalMsg)
  const alvoRelatorio =
    financeiros.find((c) => padraoId && String(c.ecossistema_id ?? '') === padraoId)?.id ?? financeiros[0]?.id
  for (const c of financeiros) {
    const eco = c.ecossistema_id != null ? String(c.ecossistema_id) : ''
    const extra = c.id === alvoRelatorio ? relatorios : 0
    contagens[c.id] = (msgPorEco.get(eco) ?? 0) + extra
  }
  return contagens
}

/** Não lidas do mensageiro 1:1 agrupadas pelo bloco. */
export async function contarMensageiroFinanceiroNaoLidasPorEcossistema(
  supabase: SupabaseClient,
  usuarioId: string,
): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (!usuarioId) return out

  const { data: conversas, error: convErr } = await supabase
    .from('financeiro_conversas')
    .select('id, ecossistema_id')
    .eq('alvo_usuario_id', usuarioId)
    .eq('iniciada_por_adm', true)

  if (convErr) {
    console.error('contarMensageiroFinanceiroNaoLidasPorEcossistema:', convErr)
    return out
  }

  const convIds = (conversas ?? []).map((c) => String(c.id)).filter(Boolean)
  if (convIds.length === 0) return out

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
    console.error('contarMensageiroFinanceiroNaoLidasPorEcossistema mensagens:', msgErr)
    return out
  }

  const ecoPorConversa = new Map<string, string>()
  for (const c of conversas ?? []) {
    ecoPorConversa.set(String(c.id), c.ecossistema_id != null ? String(c.ecossistema_id) : '')
  }

  const vistoPorConversa = new Map<string, number>()
  for (const row of leituras ?? []) {
    const cid = String(row.conversa_id)
    const t = new Date(String(row.visto_em ?? 0)).getTime()
    if (!Number.isNaN(t)) vistoPorConversa.set(cid, t)
  }

  for (const row of mensagens ?? []) {
    const cid = row.conversa_id != null ? String(row.conversa_id) : ''
    if (!cid) continue
    const created = new Date(String(row.created_at ?? 0)).getTime()
    if (Number.isNaN(created)) continue
    const visto = vistoPorConversa.get(cid) ?? 0
    if (created <= visto) continue
    const eco = ecoPorConversa.get(cid) || ''
    out.set(eco, (out.get(eco) ?? 0) + 1)
  }

  return out
}

/** IDs de conversas com mensagens do ADM ainda não visualizadas pelo alvo. */
export async function conversasMensageiroComNaoLidas(
  supabase: SupabaseClient,
  usuarioId: string,
  ecossistemaId?: string | null,
): Promise<Set<string>> {
  const ids = new Set<string>()
  if (!usuarioId) return ids

  let convQ = supabase
    .from('financeiro_conversas')
    .select('id')
    .eq('alvo_usuario_id', usuarioId)
    .eq('iniciada_por_adm', true)
  const eco = ecossistemaId != null ? String(ecossistemaId).trim() : ''
  if (eco) convQ = convQ.eq('ecossistema_id', eco)
  const { data: conversas, error: convErr } = await convQ

  if (convErr) {
    console.error('conversasMensageiroComNaoLidas conversas:', convErr)
    return ids
  }

  const convIds = (conversas ?? []).map((c) => String(c.id)).filter(Boolean)
  if (convIds.length === 0) return ids

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
    console.error('conversasMensageiroComNaoLidas mensagens:', msgErr)
    return ids
  }

  const vistoPorConversa = new Map<string, number>()
  for (const row of leituras ?? []) {
    const cid = String(row.conversa_id)
    const t = new Date(String(row.visto_em ?? 0)).getTime()
    if (!Number.isNaN(t)) vistoPorConversa.set(cid, t)
  }

  for (const row of mensagens ?? []) {
    const cid = row.conversa_id != null ? String(row.conversa_id) : ''
    if (!cid) continue
    const created = new Date(String(row.created_at ?? 0)).getTime()
    if (Number.isNaN(created)) continue
    const visto = vistoPorConversa.get(cid) ?? 0
    if (created > visto) ids.add(cid)
  }

  return ids
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

/** Maior `visto_em` do outro participante no mensageiro financeiro (para recibo "Visto"). */
export async function buscarVistoEmOutroFinanceiro(
  supabase: SupabaseClient,
  conversaId: string,
  viewerUserId: string,
  alvoUsuarioId: string,
  admUsuarioId: string,
): Promise<number> {
  if (!conversaId || !viewerUserId) return 0

  const outroId = viewerUserId === alvoUsuarioId ? admUsuarioId : alvoUsuarioId

  const { data: leitura } = await supabase
    .from('financeiro_conversa_leitura')
    .select('visto_em')
    .eq('conversa_id', conversaId)
    .eq('usuario_id', outroId)
    .maybeSingle()

  return vistoEmParaMs(leitura?.visto_em != null ? String(leitura.visto_em) : null)
}
