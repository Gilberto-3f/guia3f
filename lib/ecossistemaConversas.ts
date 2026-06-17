import type { SupabaseClient } from '@supabase/supabase-js'
import { buscarRemetentesEmLote } from '@/lib/canalRemetentes'

export type MembroTipoEcossistema = 'turista' | 'profissional' | 'empresa'
export type StatusConversaEcossistema = 'aberta' | 'encerrada'

export type EcossistemaConversaRow = {
  id: string
  membro_usuario_id: string
  membro_tipo: MembroTipoEcossistema
  adm_responsavel_id: string | null
  status: StatusConversaEcossistema
  urgente: boolean
  alerta_urgente_visto: boolean
  assunto: string | null
  created_at: string
  updated_at: string
  encerrada_em: string | null
}

export type EcossistemaMensagemRow = {
  id: string
  conversa_id: string
  remetente_id: string
  texto: string | null
  anexo_url: string | null
  anexo_tipo: string | null
  created_at: string
}

export type PerfilMembroEcossistema = {
  usuarioId: string
  nome: string
  username: string
  fotoUrl: string | null
  subtitulo: string
  tipo: MembroTipoEcossistema
}

const COLS_MENSAGEM =
  'id, conversa_id, remetente_id, texto, anexo_url, anexo_tipo, created_at'
const COLS_MENSAGEM_BASE = 'id, conversa_id, remetente_id, texto, created_at'

export async function buscarConversaAbertaMembro(
  supabase: SupabaseClient,
  membroUsuarioId: string,
): Promise<EcossistemaConversaRow | null> {
  const { data } = await supabase
    .from('ecossistema_conversas')
    .select('*')
    .eq('membro_usuario_id', membroUsuarioId)
    .eq('status', 'aberta')
    .maybeSingle()

  return data ? mapConversa(data) : null
}

export async function listarConversasEcossistemaMembro(
  supabase: SupabaseClient,
  membroUsuarioId: string,
  opts?: { limit?: number },
): Promise<EcossistemaConversaRow[]> {
  const limit = opts?.limit ?? 30
  const { data } = await supabase
    .from('ecossistema_conversas')
    .select('*')
    .eq('membro_usuario_id', membroUsuarioId)
    .order('updated_at', { ascending: false })
    .limit(limit)

  return (data ?? []).map(mapConversa)
}

export async function abrirConversaEcossistemaMembro(
  supabase: SupabaseClient,
  params: {
    membroUsuarioId: string
    membroTipo: MembroTipoEcossistema
    urgente?: boolean
    assunto?: string | null
  },
): Promise<{ ok: boolean; conversa?: EcossistemaConversaRow; criada?: boolean; error?: string }> {
  const aberta = await buscarConversaAbertaMembro(supabase, params.membroUsuarioId)
  if (aberta) {
    if (params.urgente && !aberta.urgente) {
      const { data, error } = await supabase
        .from('ecossistema_conversas')
        .update({ urgente: true, alerta_urgente_visto: false })
        .eq('id', aberta.id)
        .select('*')
        .maybeSingle()
      if (error) return { ok: false, error: error.message }
      return { ok: true, conversa: data ? mapConversa(data) : aberta, criada: false }
    }
    return { ok: true, conversa: aberta, criada: false }
  }

  const assunto = params.assunto?.trim() ? params.assunto.trim() : null
  const { data, error } = await supabase
    .from('ecossistema_conversas')
    .insert({
      membro_usuario_id: params.membroUsuarioId,
      membro_tipo: params.membroTipo,
      status: 'aberta',
      urgente: Boolean(params.urgente),
      alerta_urgente_visto: false,
      assunto,
    })
    .select('*')
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'Não foi possível iniciar o chat.' }
  return { ok: true, conversa: mapConversa(data), criada: true }
}

export async function listarConversasAbertasAdmEcossistema(
  supabase: SupabaseClient,
  opts?: { membroTipo?: MembroTipoEcossistema },
): Promise<EcossistemaConversaRow[]> {
  let q = supabase
    .from('ecossistema_conversas')
    .select('*')
    .eq('status', 'aberta')
    .order('urgente', { ascending: false })
    .order('updated_at', { ascending: false })

  if (opts?.membroTipo) q = q.eq('membro_tipo', opts.membroTipo)

  const { data } = await q
  return (data ?? []).map(mapConversa)
}

export async function listarHistoricoConversasAdmEcossistema(
  supabase: SupabaseClient,
  opts?: { limit?: number; membroTipo?: MembroTipoEcossistema },
): Promise<EcossistemaConversaRow[]> {
  const limit = opts?.limit ?? 50
  let q = supabase
    .from('ecossistema_conversas')
    .select('*')
    .eq('status', 'encerrada')
    .order('encerrada_em', { ascending: false })
    .limit(limit)

  if (opts?.membroTipo) q = q.eq('membro_tipo', opts.membroTipo)

  const { data } = await q
  return (data ?? []).map(mapConversa)
}

export async function listarAlertasUrgentesAdm(
  supabase: SupabaseClient,
): Promise<Array<EcossistemaConversaRow & { membro: PerfilMembroEcossistema }>> {
  const { data } = await supabase
    .from('ecossistema_conversas')
    .select('*')
    .eq('status', 'aberta')
    .eq('urgente', true)
    .eq('alerta_urgente_visto', false)
    .order('created_at', { ascending: false })

  const conversas = (data ?? []).map(mapConversa)
  const perfis = await buscarPerfisMembroEcossistema(
    supabase,
    conversas.map((c) => c.membro_usuario_id),
  )

  return conversas.map((c) => ({
    ...c,
    membro: perfis.get(c.membro_usuario_id) ?? perfilMembroFallback(c.membro_usuario_id, c.membro_tipo),
  }))
}

export async function marcarAlertaUrgenteVisto(
  supabase: SupabaseClient,
  conversaId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('ecossistema_conversas')
    .update({ alerta_urgente_visto: true })
    .eq('id', conversaId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function atribuirAdmResponsavel(
  supabase: SupabaseClient,
  conversaId: string,
  admUsuarioId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('ecossistema_conversas')
    .update({ adm_responsavel_id: admUsuarioId })
    .eq('id', conversaId)
    .eq('status', 'aberta')

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function encerrarConversaEcossistema(
  supabase: SupabaseClient,
  conversaId: string,
  admUsuarioId?: string,
): Promise<{ ok: boolean; conversa?: EcossistemaConversaRow; error?: string }> {
  const patch: Record<string, unknown> = {
    status: 'encerrada',
    encerrada_em: new Date().toISOString(),
  }
  if (admUsuarioId) patch.adm_responsavel_id = admUsuarioId

  const { data, error } = await supabase
    .from('ecossistema_conversas')
    .update(patch)
    .eq('id', conversaId)
    .eq('status', 'aberta')
    .select('*')
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'Conversa não encontrada ou já encerrada.' }
  return { ok: true, conversa: mapConversa(data) }
}

export async function listarMensagensEcossistema(
  supabase: SupabaseClient,
  conversaId: string,
): Promise<EcossistemaMensagemRow[]> {
  let { data, error } = await supabase
    .from('ecossistema_mensagens')
    .select(COLS_MENSAGEM)
    .eq('conversa_id', conversaId)
    .order('created_at', { ascending: true })

  if (error) {
    const retry = await supabase
      .from('ecossistema_mensagens')
      .select(COLS_MENSAGEM_BASE)
      .eq('conversa_id', conversaId)
      .order('created_at', { ascending: true })
    if (retry.error) return []
    data = (retry.data ?? []).map((row) => ({ ...row, anexo_url: null, anexo_tipo: null }))
  }

  return (data ?? []).map((row) => mapMensagem(row as Record<string, unknown>))
}

export async function enviarMensagemEcossistema(
  supabase: SupabaseClient,
  params: {
    conversaId: string
    remetenteId: string
    texto?: string | null
    anexo_url?: string | null
    anexo_tipo?: string | null
  },
): Promise<{ ok: boolean; mensagem?: EcossistemaMensagemRow; error?: string }> {
  const texto = params.texto?.trim() ? params.texto.trim() : null
  const anexoUrl = params.anexo_url?.trim() ? params.anexo_url.trim() : null
  const anexoTipo = params.anexo_tipo?.trim() ? params.anexo_tipo.trim() : null

  if (!texto && !anexoUrl) return { ok: false, error: 'Mensagem vazia.' }

  const { data: conv } = await supabase
    .from('ecossistema_conversas')
    .select('id, status')
    .eq('id', params.conversaId)
    .maybeSingle()

  if (!conv || String(conv.status) !== 'aberta') {
    return { ok: false, error: 'Conversa encerrada ou inexistente.' }
  }

  const { data, error } = await supabase
    .from('ecossistema_mensagens')
    .insert({
      conversa_id: params.conversaId,
      remetente_id: params.remetenteId,
      texto,
      anexo_url: anexoUrl,
      anexo_tipo: anexoTipo,
    })
    .select(COLS_MENSAGEM)
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'Falha ao enviar.' }

  await supabase
    .from('ecossistema_conversas')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', params.conversaId)

  return { ok: true, mensagem: mapMensagem(data as Record<string, unknown>) }
}

export async function buscarPerfisMembroEcossistema(
  supabase: SupabaseClient,
  usuarioIds: string[],
): Promise<Map<string, PerfilMembroEcossistema>> {
  const map = new Map<string, PerfilMembroEcossistema>()
  const unique = [...new Set(usuarioIds.filter(Boolean))]
  if (unique.length === 0) return map

  const [{ data: turistas }, { data: profs }, { data: emps }] = await Promise.all([
    supabase
      .from('turistas')
      .select('usuario_id, nome_completo, nome_usuario, foto_url')
      .in('usuario_id', unique),
    supabase
      .from('profissionais')
      .select('usuario_id, nome_completo, nome_usuario, foto_url, foto_perfil_url, categorias')
      .in('usuario_id', unique),
    supabase
      .from('empresas')
      .select('usuario_id, nome_fantasia, nome_usuario, foto_url, categoria')
      .in('usuario_id', unique),
  ])

  for (const t of turistas ?? []) {
    const uid = String(t.usuario_id)
    const nu = String(t.nome_usuario ?? '').trim()
    map.set(uid, {
      usuarioId: uid,
      nome: String(t.nome_completo ?? 'Turista'),
      username: nu ? `@${nu}` : '@—',
      fotoUrl: t.foto_url != null ? String(t.foto_url) : null,
      subtitulo: 'Turista',
      tipo: 'turista',
    })
  }

  for (const p of profs ?? []) {
    const uid = String(p.usuario_id)
    const nu = String(p.nome_usuario ?? '').trim()
    const cats = Array.isArray(p.categorias) ? p.categorias.join(', ') : ''
    map.set(uid, {
      usuarioId: uid,
      nome: String(p.nome_completo ?? 'Profissional'),
      username: nu ? `@${nu}` : '@—',
      fotoUrl:
        p.foto_perfil_url != null
          ? String(p.foto_perfil_url)
          : p.foto_url != null
            ? String(p.foto_url)
            : null,
      subtitulo: cats,
      tipo: 'profissional',
    })
  }

  for (const e of emps ?? []) {
    const uid = String(e.usuario_id)
    const nu = String(e.nome_usuario ?? '').trim()
    map.set(uid, {
      usuarioId: uid,
      nome: String(e.nome_fantasia ?? 'Empresa'),
      username: nu ? `@${nu}` : '@—',
      fotoUrl: e.foto_url != null ? String(e.foto_url) : null,
      subtitulo: String(e.categoria ?? ''),
      tipo: 'empresa',
    })
  }

  return map
}

export function roleParaMembroTipo(role: string | null | undefined): MembroTipoEcossistema | null {
  if (role === 'turista') return 'turista'
  if (role === 'profissional') return 'profissional'
  if (role === 'empresa') return 'empresa'
  return null
}

const ROLES_MEMBRO_ECOSSISTEMA = new Set(['turista', 'profissional', 'empresa'])

export async function buscarUltimaMensagemEcossistema(
  supabase: SupabaseClient,
): Promise<string | null> {
  const { data } = await supabase
    .from('ecossistema_mensagens')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data?.created_at != null ? String(data.created_at) : null
}

/**
 * Contagem de não lidas no Mensageiro ECOSSISTEMA (mensagens de membros + chats iniciados).
 */
export async function contarNaoLidasEcossistemaAdm(
  supabase: SupabaseClient,
  adminUserId: string,
  vistoMs: number,
): Promise<number> {
  const { data: conversas, error: convErr } = await supabase
    .from('ecossistema_conversas')
    .select('id, created_at, membro_usuario_id')
    .eq('status', 'aberta')

  if (convErr) {
    console.error('contarNaoLidasEcossistemaAdm conversas:', convErr)
    return 0
  }

  const abertas = conversas ?? []
  if (abertas.length === 0) return 0

  const conversaIds = abertas.map((c) => String(c.id))
  const desdeIso = vistoMs > 0 ? new Date(vistoMs).toISOString() : new Date(0).toISOString()

  const { data: mensagens, error: msgErr } = await supabase
    .from('ecossistema_mensagens')
    .select('conversa_id, remetente_id, created_at')
    .in('conversa_id', conversaIds)
    .gt('created_at', desdeIso)
    .neq('remetente_id', adminUserId)

  if (msgErr) {
    console.error('contarNaoLidasEcossistemaAdm mensagens:', msgErr)
    return 0
  }

  const msgs = mensagens ?? []
  const remetenteIds = [...new Set(msgs.map((m) => String(m.remetente_id)).filter(Boolean))]
  const membroIds = [...new Set(abertas.map((c) => String(c.membro_usuario_id)).filter(Boolean))]
  const idsRoles = [...new Set([...remetenteIds, ...membroIds])]

  const { data: usuarios } =
    idsRoles.length > 0
      ? await supabase.from('usuarios').select('id, role').in('id', idsRoles)
      : { data: [] }

  const membroPorId = new Set(
    (usuarios ?? [])
      .filter((u) => ROLES_MEMBRO_ECOSSISTEMA.has(String(u.role ?? '')))
      .map((u) => String(u.id)),
  )

  let n = 0
  for (const m of msgs) {
    const rid = m.remetente_id != null ? String(m.remetente_id) : ''
    if (!rid || !membroPorId.has(rid)) continue
    n += 1
  }

  for (const c of abertas) {
    const created = new Date(String(c.created_at ?? 0)).getTime()
    if (Number.isNaN(created) || created <= vistoMs) continue
    const temMsgMembro = msgs.some(
      (m) =>
        String(m.conversa_id) === String(c.id) &&
        membroPorId.has(String(m.remetente_id ?? '')),
    )
    if (!temMsgMembro) n += 1
  }

  return n
}

function perfilMembroFallback(usuarioId: string, tipo: MembroTipoEcossistema): PerfilMembroEcossistema {
  return {
    usuarioId,
    nome: tipo === 'empresa' ? 'Empresa' : tipo === 'profissional' ? 'Profissional' : 'Turista',
    username: '@—',
    fotoUrl: null,
    subtitulo: '',
    tipo,
  }
}

function mapMensagem(row: Record<string, unknown>): EcossistemaMensagemRow {
  return {
    id: String(row.id),
    conversa_id: String(row.conversa_id),
    remetente_id: String(row.remetente_id),
    texto: row.texto != null ? String(row.texto) : null,
    anexo_url: row.anexo_url != null ? String(row.anexo_url) : null,
    anexo_tipo: row.anexo_tipo != null ? String(row.anexo_tipo) : null,
    created_at: String(row.created_at ?? ''),
  }
}

function mapConversa(row: Record<string, unknown>): EcossistemaConversaRow {
  const tipo = row.membro_tipo
  const membroTipo: MembroTipoEcossistema =
    tipo === 'empresa' ? 'empresa' : tipo === 'profissional' ? 'profissional' : 'turista'

  return {
    id: String(row.id),
    membro_usuario_id: String(row.membro_usuario_id),
    membro_tipo: membroTipo,
    adm_responsavel_id: row.adm_responsavel_id != null ? String(row.adm_responsavel_id) : null,
    status: row.status === 'encerrada' ? 'encerrada' : 'aberta',
    urgente: Boolean(row.urgente),
    alerta_urgente_visto: Boolean(row.alerta_urgente_visto),
    assunto: row.assunto != null ? String(row.assunto) : null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
    encerrada_em: row.encerrada_em != null ? String(row.encerrada_em) : null,
  }
}
