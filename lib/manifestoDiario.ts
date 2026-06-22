import type { SupabaseClient } from '@supabase/supabase-js'
import { inserirNotificacaoCanalFinanceiroEmpresa } from '@/lib/canalFinanceiroEmpresa'
import { inserirNotificacaoCanalFinanceiroProfissional } from '@/lib/canalFinanceiroProfissional'
import { joinSupabaseRow } from '@/lib/supabaseJoinRow'

export type ManifestoDiarioStatus =
  | 'rascunho'
  | 'confirmado'
  | 'em_andamento'
  | 'concluido'
  | 'cancelado'

export type ContratacaoTipo = 'indicacao' | 'contratacao_direta' | 'agendamento' | 'algoritmo'

export type MetodoValidacaoCheckin = 'gps' | 'qr_code' | 'manual'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function filtrarEmpresaIds(ids: string[]): string[] {
  return [...new Set(ids.filter((id) => UUID_RE.test(id)))]
}

const ROTULO_CONTRATACAO: Record<ContratacaoTipo, string> = {
  indicacao: 'Indicação',
  contratacao_direta: 'Contratação direta',
  agendamento: 'Agendamento',
  algoritmo: 'Algoritmo',
}

export function rotuloContratacao(tipo: string): string {
  return ROTULO_CONTRATACAO[tipo as ContratacaoTipo] ?? tipo
}

export async function buscarProfissionalPlacaVermelha(
  supabase: SupabaseClient,
  usuarioId: string,
): Promise<{ id: string; placa_vermelha: boolean } | null> {
  const { data } = await supabase
    .from('profissionais')
    .select('id, placa_vermelha, categorias')
    .eq('usuario_id', usuarioId)
    .maybeSingle()

  if (!data?.id) return null
  return { id: String(data.id), placa_vermelha: Boolean(data.placa_vermelha) }
}

export async function obterOuCriarManifestoDiario(
  supabase: SupabaseClient,
  profissionalId: string,
  dataManifesto: string,
  statusInicial: ManifestoDiarioStatus = 'em_andamento',
): Promise<{ id: string; created: boolean } | { error: string }> {
  const { data: existente } = await supabase
    .from('manifesto_diario')
    .select('id, status')
    .eq('profissional_id', profissionalId)
    .eq('data_manifesto', dataManifesto)
    .not('status', 'in', '("cancelado","concluido")')
    .maybeSingle()

  if (existente?.id) {
    return { id: String(existente.id), created: false }
  }

  const { data: novo, error } = await supabase
    .from('manifesto_diario')
    .insert({
      profissional_id: profissionalId,
      data_manifesto: dataManifesto,
      status: statusInicial,
    })
    .select('id')
    .maybeSingle()

  if (error) return { error: error.message }
  return { id: String(novo!.id), created: true }
}

export type InserirPassageiroParams = {
  manifestoId: string
  turistaUsuarioId: string
  nome: string
  documento?: string | null
  username?: string | null
  contratacaoTipo: ContratacaoTipo
  profissionalIndiretoId?: string | null
  legacyManifestoId?: string | null
}

export async function inserirPassageiroManifesto(
  supabase: SupabaseClient,
  params: InserirPassageiroParams,
): Promise<{ id: string } | { error: string }> {
  const { data: dup } = await supabase
    .from('manifesto_passageiros')
    .select('id')
    .eq('manifesto_id', params.manifestoId)
    .eq('turista_id', params.turistaUsuarioId)
    .maybeSingle()

  if (dup?.id) return { id: String(dup.id) }

  const { data, error } = await supabase
    .from('manifesto_passageiros')
    .insert({
      manifesto_id: params.manifestoId,
      turista_id: params.turistaUsuarioId,
      nome: params.nome,
      documento: params.documento ?? null,
      username: params.username ?? null,
      contratacao_tipo: params.contratacaoTipo,
      profissional_indireto_id: params.profissionalIndiretoId ?? null,
      legacy_manifesto_id: params.legacyManifestoId ?? null,
    })
    .select('id')
    .maybeSingle()

  if (error) return { error: error.message }
  return { id: String(data!.id) }
}

export async function inserirAtrativosManifesto(
  supabase: SupabaseClient,
  params: {
    manifestoId: string
    turistaUsuarioId: string
    empresaIds: string[]
    profissionalIndiretoId?: string | null
  },
): Promise<void> {
  const ids = filtrarEmpresaIds(params.empresaIds)
  if (ids.length === 0) return

  for (const empresaId of ids) {
    const { data: dup } = await supabase
      .from('manifesto_atrativos')
      .select('id')
      .eq('manifesto_id', params.manifestoId)
      .eq('turista_id', params.turistaUsuarioId)
      .eq('empresa_id', empresaId)
      .maybeSingle()

    if (dup?.id) continue

    await supabase.from('manifesto_atrativos').insert({
      manifesto_id: params.manifestoId,
      turista_id: params.turistaUsuarioId,
      empresa_id: empresaId,
    })
  }

  if (params.profissionalIndiretoId) {
    const { data: profInd } = await supabase
      .from('profissionais')
      .select('usuario_id, nome_completo')
      .eq('id', params.profissionalIndiretoId)
      .maybeSingle()

    if (profInd?.usuario_id) {
      const { count } = await supabase
        .from('manifesto_atrativos')
        .select('id', { count: 'exact', head: true })
        .eq('manifesto_id', params.manifestoId)
        .eq('turista_id', params.turistaUsuarioId)

      await inserirNotificacaoCanalFinanceiroProfissional(supabase, {
        profissionalUsuarioId: String(profInd.usuario_id),
        tipo: 'extrato_parceria',
        titulo: 'Turista selecionou atrativos — parceria 50/50',
        mensagem: `${count ?? ids.length} atrativo(s) agendado(s) no manifesto. Benefícios de parceria serão calculados ao concluir o manifesto.`,
        comprovanteDetalhes: {
          manifesto_id: params.manifestoId,
          turista_usuario_id: params.turistaUsuarioId,
          empresa_ids: ids,
          profissional_indireto_id: params.profissionalIndiretoId,
        },
      })
    }
  }
}

/** Registra turista no manifesto diário do profissional (4 formas de entrada). */
export async function registrarTuristaNoManifesto(
  supabase: SupabaseClient,
  params: {
    profissionalId: string
    turistaUsuarioId: string
    contratacaoTipo: ContratacaoTipo
    profissionalIndiretoId?: string | null
    dataManifesto?: string
    atrativosEmpresaIds?: string[]
    legacyManifestoId?: string | null
    dadosTurista?: { nome: string; documento?: string | null; username?: string | null }
  },
): Promise<{ manifestoId: string; passageiroId: string } | { error: string }> {
  const dataManifesto = params.dataManifesto ?? new Date().toISOString().slice(0, 10)

  const diario = await obterOuCriarManifestoDiario(supabase, params.profissionalId, dataManifesto, 'em_andamento')
  if ('error' in diario) return { error: diario.error }

  let nome = params.dadosTurista?.nome ?? 'Turista'
  let documento = params.dadosTurista?.documento ?? null
  let username = params.dadosTurista?.username ?? null

  if (!params.dadosTurista) {
    const { data: tur } = await supabase
      .from('turistas')
      .select('nome_completo, nome_usuario, documento_identidade')
      .eq('usuario_id', params.turistaUsuarioId)
      .maybeSingle()
    if (tur) {
      nome = String(tur.nome_completo ?? nome)
      documento = tur.documento_identidade != null ? String(tur.documento_identidade) : null
      const un = tur.nome_usuario != null ? String(tur.nome_usuario).replace(/^@+/, '') : ''
      username = un ? `@${un}` : null
    }
  }

  const passageiro = await inserirPassageiroManifesto(supabase, {
    manifestoId: diario.id,
    turistaUsuarioId: params.turistaUsuarioId,
    nome,
    documento,
    username,
    contratacaoTipo: params.contratacaoTipo,
    profissionalIndiretoId: params.profissionalIndiretoId ?? null,
    legacyManifestoId: params.legacyManifestoId ?? null,
  })

  if ('error' in passageiro) return { error: passageiro.error }

  if (params.atrativosEmpresaIds?.length) {
    await inserirAtrativosManifesto(supabase, {
      manifestoId: diario.id,
      turistaUsuarioId: params.turistaUsuarioId,
      empresaIds: params.atrativosEmpresaIds,
      profissionalIndiretoId: params.profissionalIndiretoId ?? null,
    })
  }

  return { manifestoId: diario.id, passageiroId: passageiro.id }
}

export async function confirmarCheckInManifesto(
  supabase: SupabaseClient,
  params: {
    manifestoId: string
    empresaId: string
    turistaUsuarioId?: string | null
    metodo: MetodoValidacaoCheckin
  },
): Promise<{ ok: boolean; error?: string }> {
  const agora = new Date().toISOString()

  const { data: checkin, error: insErr } = await supabase
    .from('manifesto_checkins')
    .insert({
      manifesto_id: params.manifestoId,
      empresa_id: params.empresaId,
      turista_id: params.turistaUsuarioId ?? null,
      horario_chegada: agora,
      status: 'confirmado',
      confirmado_em: agora,
      metodo_validacao: params.metodo,
    })
    .select('id')
    .maybeSingle()

  if (insErr) return { ok: false, error: insErr.message }

  let updAtr = supabase
    .from('manifesto_atrativos')
    .update({ visitado: true, visitado_em: agora })
    .eq('manifesto_id', params.manifestoId)
    .eq('empresa_id', params.empresaId)
  if (params.turistaUsuarioId) {
    updAtr = updAtr.eq('turista_id', params.turistaUsuarioId)
  }
  await updAtr

  const { data: emp } = await supabase
    .from('empresas')
    .select('usuario_id, nome_fantasia')
    .eq('id', params.empresaId)
    .maybeSingle()

  if (emp?.usuario_id) {
    await inserirNotificacaoCanalFinanceiroEmpresa(supabase, {
      empresaUsuarioId: String(emp.usuario_id),
      tipo: 'relatorio_pax',
      titulo: 'Check-in confirmado no manifesto',
      mensagem: `Check-in confirmado (${params.metodo}) em ${String(emp.nome_fantasia ?? 'sua empresa')}.`,
      comprovanteDetalhes: {
        manifesto_id: params.manifestoId,
        empresa_id: params.empresaId,
        checkin_id: checkin?.id,
        metodo_validacao: params.metodo,
      },
    })
  }

  return { ok: true }
}

export async function concluirManifestoDiario(
  supabase: SupabaseClient,
  manifestoId: string,
  profissionalId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data: md, error: mdErr } = await supabase
    .from('manifesto_diario')
    .select('id, status, profissional_id')
    .eq('id', manifestoId)
    .eq('profissional_id', profissionalId)
    .maybeSingle()

  if (mdErr || !md) return { ok: false, error: 'Manifesto não encontrado.' }
  if (String(md.status) === 'concluido') return { ok: true }

  const { data: atrativos } = await supabase
    .from('manifesto_atrativos')
    .select('id, visitado, empresa_id')
    .eq('manifesto_id', manifestoId)

  const pendentes = (atrativos ?? []).filter((a) => !a.visitado)
  if (pendentes.length > 0) {
    return { ok: false, error: 'Confirme check-in em todos os atrativos antes de concluir.' }
  }

  const agora = new Date().toISOString()
  const { error: updErr } = await supabase
    .from('manifesto_diario')
    .update({ status: 'concluido', concluido_em: agora, updated_at: agora })
    .eq('id', manifestoId)

  if (updErr) return { ok: false, error: updErr.message }

  const { data: prof } = await supabase
    .from('profissionais')
    .select('usuario_id, nome_completo')
    .eq('id', profissionalId)
    .maybeSingle()

  const { data: passageiros } = await supabase
    .from('manifesto_passageiros')
    .select('nome, profissional_indireto_id, turista_id')
    .eq('manifesto_id', manifestoId)

  const qtdPax = passageiros?.length ?? 0
  const qtdAtr = atrativos?.length ?? 0

  if (prof?.usuario_id) {
    await inserirNotificacaoCanalFinanceiroProfissional(supabase, {
      profissionalUsuarioId: String(prof.usuario_id),
      tipo: 'extrato_comissao',
      titulo: 'Manifesto concluído — resumo do dia',
      mensagem: `Manifesto concluído com ${qtdPax} passageiro(s) e ${qtdAtr} atrativo(s) visitados.`,
      comprovanteDetalhes: { manifesto_id: manifestoId, qtd_passageiros: qtdPax, qtd_atrativos: qtdAtr },
    })
  }

  const indiretosVistos = new Set<string>()
  for (const p of passageiros ?? []) {
    const indId = p.profissional_indireto_id != null ? String(p.profissional_indireto_id) : ''
    if (!indId || indiretosVistos.has(indId)) continue
    indiretosVistos.add(indId)

    const { data: pi } = await supabase
      .from('profissionais')
      .select('usuario_id')
      .eq('id', indId)
      .maybeSingle()

    if (pi?.usuario_id) {
      await inserirNotificacaoCanalFinanceiroProfissional(supabase, {
        profissionalUsuarioId: String(pi.usuario_id),
        tipo: 'manifesto_indicacao',
        titulo: 'Manifesto concluído — benefícios de parceria',
        mensagem: `O manifesto com turista ${String(p.nome)} foi concluído. Consulte o Canal Financeiro para os benefícios da parceria 50/50.`,
        comprovanteDetalhes: { manifesto_id: manifestoId, turista_nome: p.nome },
      })
    }
  }

  const turistaIds = (passageiros ?? [])
    .map((p) => (p as { turista_id?: string }).turista_id)
    .filter(Boolean) as string[]

  if (turistaIds.length > 0) {
    await supabase
      .from('parcerias_profissionais')
      .update({ status: 'concluida' })
      .in('turista_usuario_id', turistaIds)
      .eq('status', 'em_andamento')
  }

  return { ok: true }
}

export async function buscarAtrativosParceriaIndireto(
  supabase: SupabaseClient,
  profissionalIndiretoId: string,
  turistaUsuarioId?: string | null,
): Promise<
  Array<{
    empresa_id: string
    empresa_nome: string
    categoria: string
    visitado: boolean
    selecionado_em: string
  }>
> {
  let q = supabase
    .from('manifesto_passageiros')
    .select(
      `
      manifesto_id,
      turista_id,
      manifesto_atrativos:manifesto_id (
        empresa_id,
        visitado,
        selecionado_em,
        empresas:empresa_id (nome_fantasia, categoria)
      )
    `,
    )
    .eq('profissional_indireto_id', profissionalIndiretoId)

  if (turistaUsuarioId) q = q.eq('turista_id', turistaUsuarioId)

  const { data } = await q
  const out: Array<{
    empresa_id: string
    empresa_nome: string
    categoria: string
    visitado: boolean
    selecionado_em: string
  }> = []

  for (const row of data ?? []) {
    const atrs = row.manifesto_atrativos
    const lista = Array.isArray(atrs) ? atrs : atrs ? [atrs] : []
    for (const a of lista) {
      const emp = joinSupabaseRow(a.empresas)
      if (!a.empresa_id) continue
      out.push({
        empresa_id: String(a.empresa_id),
        empresa_nome: String(emp?.nome_fantasia ?? 'Empresa'),
        categoria: String(emp?.categoria ?? ''),
        visitado: Boolean(a.visitado),
        selecionado_em: String(a.selecionado_em ?? ''),
      })
    }
  }

  return out
}
