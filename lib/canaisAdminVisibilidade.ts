import type { SupabaseClient } from '@supabase/supabase-js'
import { nomeNormCanal } from '@/lib/rotulosCanaisAdministracao'
import { contarNaoLidasEcossistemaAdm } from '@/lib/ecossistemaConversas'

/** Remetentes que geram notificação para o perfil admin (inbox Mensageiro ADM). */
export const ROLES_REMETENTE_NOTIFICAM_ADMIN = ['turista', 'profissional', 'empresa'] as const

export type CanalInboxAdm = {
  id: string
  nome?: string | null
  tipo_publico?: string | null
}

/** Canal BD `Mensageiro ECOSSISTEMA` (ou legado `Mensageiro ADM`) — inbox membro → equipe ADM. */
export function ehCanalInboxMensageiroAdm(c: {
  nome?: string | null
  tipo_publico?: string | null
}): boolean {
  if (c.tipo_publico !== 'admin') return false
  const n = nomeNormCanal(c.nome)
  return n === 'MENSAGEIRO ECOSSISTEMA' || n === 'MENSAGEIRO ADM'
}

export function ehCanalInboxEcossistemaAdm(c: {
  nome?: string | null
  tipo_publico?: string | null
}): boolean {
  if (c.tipo_publico !== 'admin') return false
  return nomeNormCanal(c.nome) === 'MENSAGEIRO ECOSSISTEMA'
}

/**
 * ID do canal inbox Mensageiro ADM (único canal que entra no contador da barra para admin).
 */
export async function obterIdCanalInboxMensageiroAdm(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase
    .from('canais')
    .select('id, nome, tipo_publico')
    .eq('ativo', true)
    .eq('tipo_publico', 'admin')

  if (error) {
    console.error('obterIdCanalInboxMensageiroAdm:', error)
    return null
  }

  const canal =
    (data ?? []).find((c) => nomeNormCanal(c.nome) === 'MENSAGEIRO ECOSSISTEMA') ??
    (data ?? []).find((c) => nomeNormCanal(c.nome) === 'MENSAGEIRO ADM')
  return canal?.id != null ? String(canal.id) : null
}

/**
 * Canais que entram na contagem de não lidas do admin: somente o inbox Mensageiro ADM.
 */
export async function obterIdsCanaisMensagensAdmin(supabase: SupabaseClient): Promise<Set<string>> {
  const id = await obterIdCanalInboxMensageiroAdm(supabase)
  return id ? new Set([id]) : new Set()
}

/**
 * Mensagens não lidas no inbox Mensageiro ADM (barra inferior / total admin).
 * Ignora mensagens de outros administradores e canais de broadcast.
 */
export async function contarMensagensNaoLidasInboxAdmin(
  supabase: SupabaseClient,
  adminUserId: string,
): Promise<number> {
  const inboxId = await obterIdCanalInboxMensageiroAdm(supabase)
  if (!inboxId || !adminUserId) return 0

  const { data: canalRow } = await supabase.from('canais').select('nome').eq('id', inboxId).maybeSingle()
  const ecossistema = nomeNormCanal(canalRow?.nome ?? '') === 'MENSAGEIRO ECOSSISTEMA'

  const { data: leitura } = await supabase
    .from('canal_leitura_profissional')
    .select('visto_em')
    .eq('usuario_id', adminUserId)
    .eq('canal_id', inboxId)
    .maybeSingle()

  const visto = new Date(String(leitura?.visto_em ?? 0)).getTime()
  const vistoMs = Number.isNaN(visto) ? 0 : visto

  if (ecossistema) {
    return contarNaoLidasEcossistemaAdm(supabase, adminUserId, vistoMs)
  }

  const desde = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString()
  const { data: mensagens, error: msgErr } = await supabase
    .from('mensagens_canal')
    .select('remetente_id, created_at')
    .eq('canal_id', inboxId)
    .neq('remetente_id', adminUserId)
    .gte('created_at', desde)
    .limit(500)

  if (msgErr) {
    console.error('contarMensagensNaoLidasInboxAdmin:', msgErr)
    return 0
  }

  const rows = mensagens ?? []
  if (rows.length === 0) return 0

  const remetenteIds = [...new Set(rows.map((r) => String(r.remetente_id)).filter(Boolean))]
  const { data: usuarios } = await supabase.from('usuarios').select('id, role').in('id', remetenteIds)

  const rolesNotificam = new Set<string>(ROLES_REMETENTE_NOTIFICAM_ADMIN)
  const remetenteNotifica = new Set(
    (usuarios ?? [])
      .filter((u) => rolesNotificam.has(String(u.role ?? '')))
      .map((u) => String(u.id)),
  )

  let n = 0
  for (const row of rows) {
    const rid = row.remetente_id != null ? String(row.remetente_id) : ''
    if (!rid || !remetenteNotifica.has(rid)) continue

    const created = new Date(String(row.created_at ?? 0)).getTime()
    if (Number.isNaN(created)) continue
    if (created > vistoMs) n += 1
  }

  return n
}

/**
 * Badges por canal na lista admin: só o inbox pode ter contagem; demais ficam em 0.
 */
export async function contarNaoLidasPorCanalIdsAdmin(
  supabase: SupabaseClient,
  adminUserId: string,
  canalIds: string[],
): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  for (const id of canalIds) out[id] = 0
  if (!adminUserId || canalIds.length === 0) return out

  const inboxId = await obterIdCanalInboxMensageiroAdm(supabase)
  if (!inboxId || !canalIds.includes(inboxId)) return out

  const total = await contarMensagensNaoLidasInboxAdmin(supabase, adminUserId)
  out[inboxId] = total
  return out
}
