import type { SupabaseClient } from '@supabase/supabase-js'

export type AlvoTipoFinanceiro = 'profissional' | 'empresa'
export type StatusConversaFinanceiro = 'aberta' | 'encerrada'

export type FinanceiroConversaRow = {
  id: string
  adm_usuario_id: string
  alvo_usuario_id: string
  alvo_tipo: AlvoTipoFinanceiro
  status: StatusConversaFinanceiro
  iniciada_por_adm: boolean
  assunto: string | null
  created_at: string
  updated_at: string
  encerrada_em: string | null
}

export type FinanceiroMensagemRow = {
  id: string
  conversa_id: string
  remetente_id: string
  texto: string | null
  anexo_url: string | null
  anexo_tipo: string | null
  created_at: string
}

export type DestinatarioFinanceiroBusca = {
  usuarioId: string
  nome: string
  username: string
  fotoUrl: string | null
  subtitulo: string
}

/** Busca profissionais ou empresas para o canal financeiro ADM. */
export async function buscarDestinatariosFinanceiro(
  supabase: SupabaseClient,
  tipo: AlvoTipoFinanceiro,
  termo: string,
  limit = 12,
): Promise<DestinatarioFinanceiroBusca[]> {
  const q = termo.trim()
  if (q.length < 2) return []

  if (tipo === 'profissional') {
    const { data } = await supabase
      .from('profissionais')
      .select('usuario_id, nome_completo, nome_usuario, foto_url, foto_perfil_url, categorias')
      .or(`nome_completo.ilike.%${q}%,nome_usuario.ilike.%${q}%`)
      .limit(limit)

    return (data ?? []).map((p) => {
      const foto =
        p.foto_perfil_url != null
          ? String(p.foto_perfil_url)
          : p.foto_url != null
            ? String(p.foto_url)
            : null
      const username = String(p.nome_usuario ?? '').trim()
      const cats = Array.isArray(p.categorias) ? p.categorias.join(', ') : ''
      return {
        usuarioId: String(p.usuario_id),
        nome: String(p.nome_completo ?? 'Profissional'),
        username: username ? `@${username}` : '@—',
        fotoUrl: foto,
        subtitulo: cats,
      }
    })
  }

  const { data } = await supabase
    .from('empresas')
    .select('usuario_id, nome_fantasia, nome_usuario, foto_url, categoria')
    .or(`nome_fantasia.ilike.%${q}%,nome_usuario.ilike.%${q}%`)
    .limit(limit)

  return (data ?? []).map((e) => {
    const username = String(e.nome_usuario ?? '').trim()
    return {
      usuarioId: String(e.usuario_id),
      nome: String(e.nome_fantasia ?? 'Empresa'),
      username: username ? `@${username}` : '@—',
      fotoUrl: e.foto_url != null ? String(e.foto_url) : null,
      subtitulo: String(e.categoria ?? ''),
    }
  })
}

/** Abre conversa ou devolve a já aberta entre ADM e alvo. */
export async function abrirConversaFinanceiroAdm(
  supabase: SupabaseClient,
  params: {
    admUsuarioId: string
    alvoUsuarioId: string
    alvoTipo: AlvoTipoFinanceiro
    assunto?: string | null
  },
): Promise<{ ok: boolean; conversa?: FinanceiroConversaRow; error?: string }> {
  const { data: aberta } = await supabase
    .from('financeiro_conversas')
    .select('*')
    .eq('adm_usuario_id', params.admUsuarioId)
    .eq('alvo_usuario_id', params.alvoUsuarioId)
    .eq('status', 'aberta')
    .maybeSingle()

  if (aberta?.id) {
    return { ok: true, conversa: mapConversa(aberta) }
  }

  const { data, error } = await supabase
    .from('financeiro_conversas')
    .insert({
      adm_usuario_id: params.admUsuarioId,
      alvo_usuario_id: params.alvoUsuarioId,
      alvo_tipo: params.alvoTipo,
      status: 'aberta',
      iniciada_por_adm: true,
      assunto: params.assunto?.trim() ? params.assunto.trim() : null,
    })
    .select('*')
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'Não foi possível criar a conversa.' }
  return { ok: true, conversa: mapConversa(data) }
}

export async function encerrarConversaFinanceiro(
  supabase: SupabaseClient,
  conversaId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('financeiro_conversas')
    .update({ status: 'encerrada', encerrada_em: new Date().toISOString() })
    .eq('id', conversaId)
    .eq('status', 'aberta')

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function listarHistoricoConversasAdm(
  supabase: SupabaseClient,
  admUsuarioId: string,
  opts?: { limit?: number },
): Promise<FinanceiroConversaRow[]> {
  const limit = opts?.limit ?? 40
  const { data } = await supabase
    .from('financeiro_conversas')
    .select('*')
    .eq('adm_usuario_id', admUsuarioId)
    .eq('iniciada_por_adm', true)
    .eq('status', 'encerrada')
    .order('encerrada_em', { ascending: false })
    .limit(limit)

  return (data ?? []).map(mapConversa)
}

export async function listarMensagensConversa(
  supabase: SupabaseClient,
  conversaId: string,
): Promise<FinanceiroMensagemRow[]> {
  const { data } = await supabase
    .from('financeiro_mensagens')
    .select('id, conversa_id, remetente_id, texto, anexo_url, anexo_tipo, created_at')
    .eq('conversa_id', conversaId)
    .order('created_at', { ascending: true })

  return (data ?? []).map(mapMensagem)
}

export async function enviarMensagemConversaFinanceiro(
  supabase: SupabaseClient,
  params: {
    conversaId: string
    remetenteId: string
    texto?: string | null
    anexo_url?: string | null
    anexo_tipo?: string | null
  },
): Promise<{ ok: boolean; mensagem?: FinanceiroMensagemRow; error?: string }> {
  const texto = params.texto?.trim() ? params.texto.trim() : null
  const anexoUrl = params.anexo_url?.trim() ? params.anexo_url.trim() : null
  const anexoTipo = params.anexo_tipo?.trim() ? params.anexo_tipo.trim() : null

  if (!texto && !anexoUrl) return { ok: false, error: 'Mensagem vazia.' }

  const { data: conv } = await supabase
    .from('financeiro_conversas')
    .select('id, status')
    .eq('id', params.conversaId)
    .maybeSingle()

  if (!conv || String(conv.status) !== 'aberta') {
    return { ok: false, error: 'Conversa encerrada ou inexistente.' }
  }

  const { data, error } = await supabase
    .from('financeiro_mensagens')
    .insert({
      conversa_id: params.conversaId,
      remetente_id: params.remetenteId,
      texto,
      anexo_url: anexoUrl,
      anexo_tipo: anexoTipo,
    })
    .select('id, conversa_id, remetente_id, texto, anexo_url, anexo_tipo, created_at')
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'Falha ao enviar.' }

  return { ok: true, mensagem: mapMensagem(data) }
}

/** Conversa aberta iniciada pelo ADM (profissional/empresa). */
export async function buscarConversaAbertaParaAlvo(
  supabase: SupabaseClient,
  alvoUsuarioId: string,
): Promise<FinanceiroConversaRow | null> {
  const { data } = await supabase
    .from('financeiro_conversas')
    .select('*')
    .eq('alvo_usuario_id', alvoUsuarioId)
    .eq('status', 'aberta')
    .eq('iniciada_por_adm', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data ? mapConversa(data) : null
}

/** Todas as conversas do mensageiro ADM para o alvo (aberta + arquivadas). */
export async function listarConversasFinanceiroParaAlvo(
  supabase: SupabaseClient,
  alvoUsuarioId: string,
  opts?: { limit?: number },
): Promise<FinanceiroConversaRow[]> {
  const limit = opts?.limit ?? 30
  const { data } = await supabase
    .from('financeiro_conversas')
    .select('*')
    .eq('alvo_usuario_id', alvoUsuarioId)
    .eq('iniciada_por_adm', true)
    .order('updated_at', { ascending: false })
    .limit(limit)

  return (data ?? []).map(mapConversa)
}

function mapMensagem(row: Record<string, unknown>): FinanceiroMensagemRow {
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

function mapConversa(row: Record<string, unknown>): FinanceiroConversaRow {
  return {
    id: String(row.id),
    adm_usuario_id: String(row.adm_usuario_id),
    alvo_usuario_id: String(row.alvo_usuario_id),
    alvo_tipo: row.alvo_tipo === 'empresa' ? 'empresa' : 'profissional',
    status: row.status === 'encerrada' ? 'encerrada' : 'aberta',
    iniciada_por_adm: Boolean(row.iniciada_por_adm),
    assunto: row.assunto != null ? String(row.assunto) : null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
    encerrada_em: row.encerrada_em != null ? String(row.encerrada_em) : null,
  }
}
