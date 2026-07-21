import type { SupabaseClient } from '@supabase/supabase-js'
import { inserirNotificacaoCanalFinanceiroEmpresa } from '@/lib/canalFinanceiroEmpresa'
import { inserirNotificacaoCanalFinanceiroProfissional } from '@/lib/canalFinanceiroProfissional'
import { mensagemPreLiberacaoPendente } from '@/lib/turistaPreLiberacaoTexto'
import { profissionalRecursosLiberados } from '@/lib/verificacao-documentos'

const HORAS_PRE_LIB = 24

export { TEXTO_PRE_LIBERACAO_CONFIRME, mensagemPreLiberacaoPendente, textoPreLiberacaoIntro } from '@/lib/turistaPreLiberacaoTexto'

export function pickFotoTurista(row: { foto_perfil_url?: string | null; foto_url?: string | null } | null): string | null {
  if (!row) return null
  const a = row.foto_perfil_url != null && String(row.foto_perfil_url).trim() !== '' ? String(row.foto_perfil_url) : null
  const b = row.foto_url != null && String(row.foto_url).trim() !== '' ? String(row.foto_url) : null
  return a ?? b
}

export type PreLiberacaoRow = {
  id: string
  turista_usuario_id: string
  profissional_usuario_id: string
  profissional_id: string
  prof_username: string
  turista_username: string | null
  turista_nome: string | null
  status: string
  solicitado_em: string
  respondido_em: string | null
  expira_em: string | null
  contratacoes: unknown[]
}

export function expiraEm24h(): string {
  return new Date(Date.now() + HORAS_PRE_LIB * 60 * 60 * 1000).toISOString()
}

/** @param {string} raw */
export function normalizarUsername(raw: string): string {
  return String(raw ?? '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
}

export async function buscarProfissionalVerificadoPorUsername(
  supabase: SupabaseClient,
  username: string,
): Promise<
  | { ok: true; profissionalId: string; usuarioId: string; nomeUsuario: string; nomeCompleto: string }
  | { ok: false; error: string }
> {
  const un = normalizarUsername(username)
  if (!un) return { ok: false, error: 'username_vazio' }

  const { data: profRows, error } = await supabase
    .from('profissionais')
    .select('id, usuario_id, nome_usuario, nome_completo, status, docs_verificado, proxima_revisao_docs_em')
    .or(`nome_usuario.ilike.${un},nome_usuario.ilike.@${un}`)
    .limit(5)

  if (error) return { ok: false, error: 'profissional_nao_encontrado' }

  const prof =
    (profRows ?? []).find((row) => {
      const stored = normalizarUsername(
        row.nome_usuario != null ? String(row.nome_usuario) : '',
      )
      return stored === un
    }) ?? null

  if (!prof?.usuario_id) return { ok: false, error: 'profissional_nao_encontrado' }

  const { data: u } = await supabase.from('usuarios').select('status').eq('id', prof.usuario_id).maybeSingle()

  if (
    !profissionalRecursosLiberados(u?.status != null ? String(u.status) : null, {
      status: prof.status != null ? String(prof.status) : null,
      docs_verificado: Boolean(prof.docs_verificado),
      proxima_revisao_docs_em: prof.proxima_revisao_docs_em != null ? String(prof.proxima_revisao_docs_em) : null,
    })
  ) {
    return { ok: false, error: 'profissional_nao_verificado' }
  }

  return {
    ok: true,
    profissionalId: String(prof.id),
    usuarioId: String(prof.usuario_id),
    nomeUsuario: String(prof.nome_usuario ?? un),
    nomeCompleto: String(prof.nome_completo ?? 'Profissional'),
  }
}

export async function inserirAvisoPreLiberacaoCanalFinanceiro(
  supabase: SupabaseClient,
  params: {
    profissionalId: string
    solicitacaoId: string
    turistaUsuarioId: string
    turistaUsername: string
    turistaNome: string
    profUsername: string
    turistaFotoUrl?: string | null
    respondido?: string
    expiraEm?: string | null
    createdAt?: string
  },
): Promise<{ ok: boolean; canalFinanceiroId?: string; error?: string }> {
  const mensagem = mensagemPreLiberacaoPendente(params.turistaUsername)

  const metadata = {
    solicitacao_id: params.solicitacaoId,
    turista_usuario_id: params.turistaUsuarioId,
    turista_username: params.turistaUsername,
    turista_nome: params.turistaNome,
    turista_foto_url: params.turistaFotoUrl ?? null,
    prof_username: params.profUsername,
    respondido: params.respondido ?? '',
    ...(params.expiraEm ? { expira_em: params.expiraEm } : {}),
  }

  const insertRow: Record<string, unknown> = {
    profissional_id: params.profissionalId,
    empresa_id: null,
    tipo: 'pre_liberacao_turista',
    titulo: 'Pré-liberação de turista',
    mensagem,
    valor: null,
    lida_por_profissional: Boolean(params.respondido),
    metadata,
  }
  if (params.createdAt) insertRow.created_at = params.createdAt

  const { data, error } = await supabase
    .from('canal_financeiro')
    .insert(insertRow)
    .select('id')
    .single()

  if (error || !data?.id) return { ok: false, error: error?.message ?? 'canal_financeiro_falhou' }
  return { ok: true, canalFinanceiroId: String(data.id) }
}

/** Garante registro no canal_financeiro após resposta (cria se faltou na solicitação). */
export async function atualizarCanalFinanceiroPreLiberacaoRespondido(
  supabase: SupabaseClient,
  sol: {
    id: string
    profissional_id: string
    turista_usuario_id: string
    turista_username: string | null
    turista_nome: string | null
    prof_username: string | null
    solicitado_em: string
    canal_financeiro_id: string | null
  },
  acao: 'aprovar' | 'recusar',
  expira?: string,
): Promise<string | null> {
  const respondido = acao === 'aprovar' ? 'aprovada' : 'recusada'
  const turistaUsername = String(sol.turista_username ?? '').trim() || 'turista'

  let turistaFotoUrl: string | null = null
  const { data: tur } = await supabase
    .from('turistas')
    .select('foto_perfil_url, foto_url')
    .eq('usuario_id', sol.turista_usuario_id)
    .maybeSingle()
  turistaFotoUrl = pickFotoTurista(tur)

  const metadata = {
    solicitacao_id: sol.id,
    turista_usuario_id: sol.turista_usuario_id,
    turista_username: turistaUsername,
    turista_nome: String(sol.turista_nome ?? '').trim() || 'Turista',
    turista_foto_url: turistaFotoUrl,
    prof_username: String(sol.prof_username ?? ''),
    respondido,
    ...(expira ? { expira_em: expira } : {}),
  }

  if (sol.canal_financeiro_id) {
    const { error } = await supabase
      .from('canal_financeiro')
      .update({
        mensagem: mensagemPreLiberacaoPendente(turistaUsername),
        lida_por_profissional: true,
        metadata,
      })
      .eq('id', sol.canal_financeiro_id)
    if (error) console.error('atualizarCanalFinanceiroPreLiberacaoRespondido:', error)
    return sol.canal_financeiro_id
  }

  const aviso = await inserirAvisoPreLiberacaoCanalFinanceiro(supabase, {
    profissionalId: sol.profissional_id,
    solicitacaoId: sol.id,
    turistaUsuarioId: sol.turista_usuario_id,
    turistaUsername,
    turistaNome: String(sol.turista_nome ?? '').trim() || 'Turista',
    profUsername: String(sol.prof_username ?? ''),
    turistaFotoUrl,
    respondido,
    expiraEm: expira ?? null,
    createdAt: sol.solicitado_em,
  })

  if (!aviso.ok || !aviso.canalFinanceiroId) return null

  await supabase
    .from('turista_pre_liberacoes')
    .update({ canal_financeiro_id: aviso.canalFinanceiroId })
    .eq('id', sol.id)

  return aviso.canalFinanceiroId
}

/** Solicitações respondidas sem card no canal (fallback de histórico). */
export async function listarPreLiberacoesHistoricoProfissional(
  supabase: SupabaseClient,
  profissionalUsuarioId: string,
): Promise<
  {
    id: string
    turista_usuario_id: string
    turista_username: string | null
    turista_nome: string | null
    solicitado_em: string
    respondido_em: string | null
    status: string
    canal_financeiro_id: string | null
    expira_em: string | null
  }[]
> {
  if (!profissionalUsuarioId) return []
  const { data, error } = await supabase
    .from('turista_pre_liberacoes')
    .select(
      'id, turista_usuario_id, turista_username, turista_nome, solicitado_em, respondido_em, status, canal_financeiro_id, expira_em',
    )
    .eq('profissional_usuario_id', profissionalUsuarioId)
    .in('status', ['aprovada', 'recusada'])
    .order('respondido_em', { ascending: false })

  if (error) {
    console.error('listarPreLiberacoesHistoricoProfissional:', error)
    return []
  }
  return (data ?? []).map((r) => ({
    id: String(r.id),
    turista_usuario_id: String(r.turista_usuario_id ?? ''),
    turista_username: r.turista_username != null ? String(r.turista_username) : null,
    turista_nome: r.turista_nome != null ? String(r.turista_nome) : null,
    solicitado_em: String(r.solicitado_em ?? ''),
    respondido_em: r.respondido_em != null ? String(r.respondido_em) : null,
    status: String(r.status ?? ''),
    canal_financeiro_id: r.canal_financeiro_id != null ? String(r.canal_financeiro_id) : null,
    expira_em: r.expira_em != null ? String(r.expira_em) : null,
  }))
}

/** Solicitações pendentes visíveis ao profissional (fallback se o aviso no canal_financeiro falhou). */
export async function listarPreLiberacoesPendentesProfissional(
  supabase: SupabaseClient,
  profissionalUsuarioId: string,
): Promise<
  {
    id: string
    turista_usuario_id: string
    turista_username: string | null
    turista_nome: string | null
    solicitado_em: string
    canal_financeiro_id: string | null
  }[]
> {
  if (!profissionalUsuarioId) return []
  const { data, error } = await supabase
    .from('turista_pre_liberacoes')
    .select('id, turista_usuario_id, turista_username, turista_nome, solicitado_em, canal_financeiro_id')
    .eq('profissional_usuario_id', profissionalUsuarioId)
    .eq('status', 'pendente')
    .order('solicitado_em', { ascending: false })

  if (error) {
    console.error('listarPreLiberacoesPendentesProfissional:', error)
    return []
  }
  return (data ?? []).map((r) => ({
    id: String(r.id),
    turista_usuario_id: String(r.turista_usuario_id ?? ''),
    turista_username: r.turista_username != null ? String(r.turista_username) : null,
    turista_nome: r.turista_nome != null ? String(r.turista_nome) : null,
    solicitado_em: String(r.solicitado_em ?? ''),
    canal_financeiro_id: r.canal_financeiro_id != null ? String(r.canal_financeiro_id) : null,
  }))
}

export function itemCanalFinanceiroPreLiberacao(p: {
  id: string
  turista_usuario_id?: string
  turista_username: string | null
  turista_nome: string | null
  turista_foto_url?: string | null
  solicitado_em: string
  respondido_em?: string | null
  status?: string
  canal_financeiro_id: string | null
  expira_em?: string | null
}) {
  const user = p.turista_username?.trim() || 'turista'
  const status = String(p.status ?? '').trim()
  const respondido =
    status === 'aprovada' ? 'aprovada' : status === 'recusada' ? 'recusada' : ''
  return {
    id: p.canal_financeiro_id ?? `tpl-${p.id}`,
    tipo: 'pre_liberacao_turista',
    titulo: 'Pré-liberação de turista',
    mensagem: mensagemPreLiberacaoPendente(user),
    valor: null,
    anexo_url: null,
    lida_por_profissional: Boolean(respondido),
    lida_por_empresa: false,
    metadata: {
      solicitacao_id: p.id,
      turista_usuario_id: p.turista_usuario_id ?? '',
      turista_username: user,
      turista_nome: p.turista_nome ?? '',
      turista_foto_url: p.turista_foto_url ?? null,
      respondido,
      ...(p.expira_em ? { expira_em: p.expira_em } : {}),
    },
    created_at: p.solicitado_em || new Date().toISOString(),
    profissional_nome: 'Profissional',
    empresa_nome: 'Empresa',
  }
}

const TIPOS_EMPRESA_PRE_LIB = new Set(['compra_ticket', 'reserva_hospedagem'])
const TIPOS_MOBILIDADE_PRE_LIB = new Set(['mobilidade', 'mobilidade_corrida', 'contratacao_mobilidade', 'corrida'])

export type EventoContratacaoPreLiberada = {
  tipo: string
  descricao: string
  empresa_id?: string | null
  profissional_usuario_id?: string | null
}

/**
 * Regra 24h: negócio do turista prospectado gera avisos no canal financeiro do profissional
 * que liberou o cadastro, da empresa contratada e do profissional regular contratado (mobilidade).
 */
async function notificarNegocioPreLiberacao24h(
  supabase: SupabaseClient,
  turistaUsuarioId: string,
  evento: EventoContratacaoPreLiberada,
  ctx: {
    profProspectorUsuarioId: string
    profUsername: string
    turistaUsername: string
    expiraEm: string
    preLiberacaoId: string
  },
): Promise<void> {
  const metaBase = {
    origem: 'pre_liberacao_24h',
    pre_liberacao_id: ctx.preLiberacaoId,
    turista_usuario_id: turistaUsuarioId,
    turista_username: ctx.turistaUsername,
    prof_prospector_usuario_id: ctx.profProspectorUsuarioId,
    prof_prospector_username: ctx.profUsername,
    expira_em: ctx.expiraEm,
    tipo_evento: evento.tipo,
    descricao: evento.descricao,
  }

  const tipo = String(evento.tipo ?? '')

  if (TIPOS_EMPRESA_PRE_LIB.has(tipo) && evento.empresa_id) {
    const { data: emp } = await supabase
      .from('empresas')
      .select('id, usuario_id, nome_fantasia')
      .eq('id', evento.empresa_id)
      .maybeSingle()

    const empNome = String(emp?.nome_fantasia ?? 'Empresa')
    const empUsuarioId = emp?.usuario_id != null ? String(emp.usuario_id) : null

    if (empUsuarioId) {
      await inserirNotificacaoCanalFinanceiroEmpresa(supabase, {
        empresaUsuarioId: empUsuarioId,
        tipo: 'pagamento_pendente',
        titulo: 'Comissão — turista prospectado (24h)',
        mensagem:
          `O turista @${ctx.turistaUsername} realizou ${rotuloTipoNegocio(tipo)} na sua empresa durante a pré-liberação de 24h vinculada ao profissional @${ctx.profUsername}.\n\n` +
          `Mesmo sem indicação direta, o negócio foi gerado pela prospecção desse profissional. Prepare o repasse da comissão conforme as regras do app.\n\n` +
          evento.descricao,
        comprovanteDetalhes: { ...metaBase, empresa_id: evento.empresa_id },
      })
    }

    await inserirNotificacaoCanalFinanceiroProfissional(supabase, {
      profissionalUsuarioId: ctx.profProspectorUsuarioId,
      tipo: 'extrato_comissao',
      titulo: 'Comissão prospectada — empresa (24h)',
      mensagem:
        `Seu turista @${ctx.turistaUsername} gerou negócio em ${empNome}:\n${evento.descricao}\n\n` +
        `Comissão a receber conforme regras do app (janela de 24h após sua pré-liberação).`,
      empresaId: evento.empresa_id,
      comprovanteDetalhes: metaBase,
    })
  }

  if (TIPOS_MOBILIDADE_PRE_LIB.has(tipo) && evento.profissional_usuario_id) {
    const contratadoId = String(evento.profissional_usuario_id)
    const { data: profContratado } = await supabase
      .from('profissionais')
      .select('nome_usuario, nome_completo, placa_vermelha')
      .eq('usuario_id', contratadoId)
      .maybeSingle()

    const contratadoNome = String(profContratado?.nome_usuario ?? profContratado?.nome_completo ?? 'Profissional')

    await inserirNotificacaoCanalFinanceiroProfissional(supabase, {
      profissionalUsuarioId: contratadoId,
      tipo: 'extrato_parceria',
      titulo: 'Parceria — turista prospectado (24h)',
      mensagem:
        `Você foi contratado pelo turista @${ctx.turistaUsername}, vinculado ao profissional @${ctx.profUsername} na janela de pré-liberação de 24h.\n\n` +
        `Há parceria indireta com @${ctx.profUsername} e repasse de comissão da taxa de serviços tabelados conforme regras do app.\n\n` +
        evento.descricao,
      comprovanteDetalhes: { ...metaBase, profissional_contratado_usuario_id: contratadoId },
    })

    await inserirNotificacaoCanalFinanceiroProfissional(supabase, {
      profissionalUsuarioId: ctx.profProspectorUsuarioId,
      tipo: 'extrato_comissao',
      titulo: 'Comissão prospectada — mobilidade (24h)',
      mensagem:
        `Seu turista @${ctx.turistaUsername} contratou @${contratadoNome} (mobilidade):\n${evento.descricao}\n\n` +
        `Comissão da taxa de serviço a receber conforme regras do app.`,
      comprovanteDetalhes: metaBase,
    })
  } else if (TIPOS_MOBILIDADE_PRE_LIB.has(tipo)) {
    await inserirNotificacaoCanalFinanceiroProfissional(supabase, {
      profissionalUsuarioId: ctx.profProspectorUsuarioId,
      tipo: 'extrato_comissao',
      titulo: 'Mobilidade prospectada (24h)',
      mensagem:
        `Seu turista @${ctx.turistaUsername} iniciou contratação de mobilidade:\n${evento.descricao}\n\n` +
        `Comissões serão calculadas quando o serviço for concluído com profissional regular.`,
      comprovanteDetalhes: metaBase,
    })
  }
}

function rotuloTipoNegocio(tipo: string): string {
  if (tipo === 'compra_ticket') return 'compra de ticket'
  if (tipo === 'reserva_hospedagem') return 'reserva de hospedagem'
  return 'contratação'
}

export async function registrarContratacaoPreLiberada(
  supabase: SupabaseClient,
  turistaUsuarioId: string,
  evento: EventoContratacaoPreLiberada,
): Promise<void> {
  const { data: u } = await supabase
    .from('usuarios')
    .select('turista_pre_liberado_ate, turista_pre_liberado_por, documentacao_validada_adm')
    .eq('id', turistaUsuarioId)
    .maybeSingle()

  if (!u?.turista_pre_liberado_ate || !u.turista_pre_liberado_por) return
  const ate = new Date(String(u.turista_pre_liberado_ate)).getTime()
  if (!Number.isFinite(ate) || ate <= Date.now()) return

  const { data: row } = await supabase
    .from('turista_pre_liberacoes')
    .select('id, contratacoes, prof_username, turista_username, profissional_usuario_id')
    .eq('turista_usuario_id', turistaUsuarioId)
    .eq('status', 'aprovada')
    .order('respondido_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!row?.id) return

  const atual = Array.isArray(row.contratacoes) ? row.contratacoes : []
  const novo = [
    ...atual,
    {
      ...evento,
      em: new Date().toISOString(),
    },
  ]

  await supabase.from('turista_pre_liberacoes').update({ contratacoes: novo }).eq('id', row.id)

  let turistaUsername = String(row.turista_username ?? '').trim()
  if (!turistaUsername) {
    const { data: tur } = await supabase
      .from('turistas')
      .select('nome_usuario')
      .eq('usuario_id', turistaUsuarioId)
      .maybeSingle()
    turistaUsername = String(tur?.nome_usuario ?? turistaUsuarioId.slice(0, 8))
  }

  await notificarNegocioPreLiberacao24h(supabase, turistaUsuarioId, evento, {
    profProspectorUsuarioId: String(u.turista_pre_liberado_por),
    profUsername: String(row.prof_username ?? 'profissional'),
    turistaUsername,
    expiraEm: String(u.turista_pre_liberado_ate),
    preLiberacaoId: String(row.id),
  })
}
