import type { SupabaseClient } from '@supabase/supabase-js'
import { obterIdsCanaisMensagensAdmin } from '@/lib/canaisAdminVisibilidade'
import {
  contarFinanceiroNaoLidasEmpresa,
  obterIdsCanaisMensagensEmpresa,
} from '@/lib/canaisEmpresaVisibilidade'
import {
  contarFinanceiroNaoLidasProfissional,
  obterIdsCanaisMensagensProfissional,
} from '@/lib/canaisProfissionalVisibilidade'

/**
 * `visto_em` após leitura: cobre a última mensagem visível (+ folga de 1s para relógio/Postgres).
 */
export function calcularVistoEmAposLeitura(ultimaMensagemIso?: string | null): string {
  let t = Date.now()
  if (ultimaMensagemIso) {
    const msg = new Date(ultimaMensagemIso).getTime()
    if (!Number.isNaN(msg)) t = Math.max(t, msg)
  }
  return new Date(t + 3000).toISOString()
}

/**
 * Última mensagem do canal (para marcar leitura com precisão).
 */
async function buscarUltimaMensagemCanal(
  supabase: SupabaseClient,
  canalId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('mensagens_canal')
    .select('created_at')
    .eq('canal_id', canalId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.created_at != null ? String(data.created_at) : null
}

/**
 * Marca o canal como lido para o utilizador (tabela `canal_leitura_profissional` — uso por qualquer role).
 */
export async function marcarCanalComoLido(
  supabase: SupabaseClient,
  usuarioId: string,
  canalId: string,
  ultimaMensagemIso?: string | null,
): Promise<boolean> {
  if (!usuarioId || !canalId) return false

  let ultima = ultimaMensagemIso
  if (!ultima) {
    ultima = await buscarUltimaMensagemCanal(supabase, canalId)
  }

  const visto_em = calcularVistoEmAposLeitura(ultima)
  const { data, error } = await supabase
    .from('canal_leitura_profissional')
    .upsert(
      {
        usuario_id: usuarioId,
        canal_id: canalId,
        visto_em,
      },
      { onConflict: 'usuario_id,canal_id' },
    )
    .select('visto_em')
    .maybeSingle()

  if (error) {
    console.error('marcarCanalComoLido:', error)
    return false
  }
  if (!data?.visto_em) {
    console.error('marcarCanalComoLido: nenhuma linha gravada (verifique RLS em canal_leitura_profissional)')
    return false
  }
  return true
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

  /** Filtra mensagens aos canais visíveis por perfil (+ avisos financeiros em tabela própria). */
  let canalIdsPermitidos: Set<string> | null = null
  let extraFinanceiro = 0
  if (role === 'profissional') {
    canalIdsPermitidos = await obterIdsCanaisMensagensProfissional(supabase, userId)
    extraFinanceiro = await contarFinanceiroNaoLidasProfissional(supabase, userId)
  } else if (role === 'empresa') {
    canalIdsPermitidos = await obterIdsCanaisMensagensEmpresa(supabase, userId)
    extraFinanceiro = await contarFinanceiroNaoLidasEmpresa(supabase, userId)
  } else if (role === 'admin') {
    canalIdsPermitidos = await obterIdsCanaisMensagensAdmin(supabase)
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

/**
 * Contagem de mensagens não lidas por canal (mesma regra da barra inferior).
 */
export async function contarNaoLidasPorCanalIds(
  supabase: SupabaseClient,
  userId: string,
  canalIds: string[],
): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  if (!userId || canalIds.length === 0) return out

  for (const id of canalIds) out[id] = 0

  const { data: leituras } = await supabase
    .from('canal_leitura_profissional')
    .select('canal_id, visto_em')
    .eq('usuario_id', userId)
    .in('canal_id', canalIds)

  const vistoPorCanal = new Map<string, number>()
  for (const row of leituras ?? []) {
    const t = new Date(String(row.visto_em ?? 0)).getTime()
    if (!Number.isNaN(t)) vistoPorCanal.set(String(row.canal_id), t)
  }

  const desde = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString()
  const { data: mensagens, error } = await supabase
    .from('mensagens_canal')
    .select('canal_id, remetente_id, created_at')
    .in('canal_id', canalIds)
    .neq('remetente_id', userId)
    .gte('created_at', desde)

  if (error) {
    console.error('contarNaoLidasPorCanalIds:', error)
    return out
  }

  for (const row of mensagens ?? []) {
    const cid = row.canal_id != null ? String(row.canal_id) : ''
    const rid = row.remetente_id != null ? String(row.remetente_id) : ''
    if (!cid || !rid || rid === userId) continue

    const created = new Date(String(row.created_at ?? 0)).getTime()
    if (Number.isNaN(created)) continue

    const visto = vistoPorCanal.get(cid) ?? 0
    if (created > visto) out[cid] = (out[cid] ?? 0) + 1
  }

  return out
}
