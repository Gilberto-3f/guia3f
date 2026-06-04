import type { SupabaseClient } from '@supabase/supabase-js'
import { profissionalRecursosLiberados } from '@/lib/verificacao-documentos'

const HORAS_PRE_LIB = 24

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

  const { data: prof, error } = await supabase
    .from('profissionais')
    .select('id, usuario_id, nome_usuario, nome_completo, status, docs_verificado, proxima_revisao_docs_em')
    .ilike('nome_usuario', un)
    .maybeSingle()

  if (error || !prof?.usuario_id) return { ok: false, error: 'profissional_nao_encontrado' }

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
  },
): Promise<{ ok: boolean; canalFinanceiroId?: string; error?: string }> {
  const mensagem =
    `O turista @${params.turistaUsername} solicitou pré-liberação de 24h para compras, reservas e mobilidade no app.\n\n` +
    `Confirme se você atendeu ou conhece este usuário.`

  const metadata = {
    solicitacao_id: params.solicitacaoId,
    turista_usuario_id: params.turistaUsuarioId,
    turista_username: params.turistaUsername,
    turista_nome: params.turistaNome,
    prof_username: params.profUsername,
    respondido: '',
  }

  const { data, error } = await supabase
    .from('canal_financeiro')
    .insert({
      profissional_id: params.profissionalId,
      empresa_id: null,
      tipo: 'pre_liberacao_turista',
      titulo: 'Pré-liberação de turista',
      mensagem,
      valor: null,
      lida_por_profissional: false,
      metadata,
    })
    .select('id')
    .single()

  if (error || !data?.id) return { ok: false, error: error?.message ?? 'canal_financeiro_falhou' }
  return { ok: true, canalFinanceiroId: String(data.id) }
}

/** Solicitações pendentes visíveis ao profissional (fallback se o aviso no canal_financeiro falhou). */
export async function listarPreLiberacoesPendentesProfissional(
  supabase: SupabaseClient,
  profissionalUsuarioId: string,
): Promise<
  {
    id: string
    turista_username: string | null
    turista_nome: string | null
    solicitado_em: string
    canal_financeiro_id: string | null
  }[]
> {
  if (!profissionalUsuarioId) return []
  const { data, error } = await supabase
    .from('turista_pre_liberacoes')
    .select('id, turista_username, turista_nome, solicitado_em, canal_financeiro_id')
    .eq('profissional_usuario_id', profissionalUsuarioId)
    .eq('status', 'pendente')
    .order('solicitado_em', { ascending: false })

  if (error) {
    console.error('listarPreLiberacoesPendentesProfissional:', error)
    return []
  }
  return (data ?? []).map((r) => ({
    id: String(r.id),
    turista_username: r.turista_username != null ? String(r.turista_username) : null,
    turista_nome: r.turista_nome != null ? String(r.turista_nome) : null,
    solicitado_em: String(r.solicitado_em ?? ''),
    canal_financeiro_id: r.canal_financeiro_id != null ? String(r.canal_financeiro_id) : null,
  }))
}

export function itemCanalFinanceiroPreLiberacao(p: {
  id: string
  turista_username: string | null
  turista_nome: string | null
  solicitado_em: string
  canal_financeiro_id: string | null
}) {
  const user = p.turista_username?.trim() || 'turista'
  return {
    id: p.canal_financeiro_id ?? `tpl-${p.id}`,
    tipo: 'pre_liberacao_turista',
    titulo: 'Pré-liberação de turista',
    mensagem:
      `O turista @${user} solicitou pré-liberação de 24h para compras, reservas e mobilidade no app.\n\n` +
      `Confirme se você atendeu ou conhece este usuário.`,
    valor: null,
    anexo_url: null,
    lida_por_profissional: false,
    lida_por_empresa: false,
    metadata: {
      solicitacao_id: p.id,
      turista_username: user,
      turista_nome: p.turista_nome ?? '',
      respondido: '',
    },
    created_at: p.solicitado_em || new Date().toISOString(),
    profissional_nome: 'Profissional',
    empresa_nome: 'Empresa',
  }
}

export async function registrarContratacaoPreLiberada(
  supabase: SupabaseClient,
  turistaUsuarioId: string,
  evento: { tipo: string; descricao: string; empresa_id?: string | null },
): Promise<void> {
  const { data: u } = await supabase
    .from('usuarios')
    .select('turista_pre_liberado_ate')
    .eq('id', turistaUsuarioId)
    .maybeSingle()

  if (!u?.turista_pre_liberado_ate) return
  const ate = new Date(String(u.turista_pre_liberado_ate)).getTime()
  if (!Number.isFinite(ate) || ate <= Date.now()) return

  const { data: row } = await supabase
    .from('turista_pre_liberacoes')
    .select('id, contratacoes')
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
}
