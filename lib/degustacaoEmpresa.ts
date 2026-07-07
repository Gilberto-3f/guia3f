import type { SupabaseClient } from '@supabase/supabase-js'
import type { ServicoPlanoId } from '@/lib/planosEmpresaCatalogo'
import { empresaRecursosLiberados } from '@/lib/verificacao-documentos'
import { inserirNotificacaoCanalFinanceiroEmpresa } from '@/lib/canalFinanceiroEmpresa'
import { garantirCanaisEmpresaComunidade } from '@/lib/canaisEmpresaGarantir'
import { normalizarPlanoSlug } from '@/lib/planosEmpresaServicosGate'

export const TITULO_DEGUSTACAO_CANAL = 'Degustação do aplicativo'

export type DegustacaoEmpresaRow = {
  id: string
  empresa_id: string
  dias: number
  status: 'aguardando_aceite' | 'ativa' | 'expirada' | 'cancelada'
  canal_financeiro_id: string | null
  plano_id: string | null
  plano_titulo: string | null
  aceito_em: string | null
  inicio_em: string | null
  expira_em: string | null
}

export function labelStatusEmpresaDegustacao(status: string, docsVerificado: boolean): string {
  const s = String(status ?? '').toLowerCase()
  if (s === 'aprovado' && docsVerificado) return 'Verificado'
  if (s === 'reprovado' || s === 'revogado' || s === 'expirado') return 'Recusado'
  return 'Pendente'
}

export function formatarDataDegustacaoPtBr(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR')
}

export type EstadoDegustacaoUi = 'aguardando_aceite' | 'ativa' | 'expirada' | 'cancelada'

export function resolverEstadoDegustacaoUi(row: {
  status?: string | null
  expira_em?: string | null
} | null | undefined): EstadoDegustacaoUi {
  const status = String(row?.status ?? '').toLowerCase()
  if (status === 'cancelada') return 'cancelada'
  if (status === 'expirada') return 'expirada'
  if (status === 'ativa') {
    const expira = row?.expira_em ? new Date(String(row.expira_em)).getTime() : 0
    if (expira > 0 && expira <= Date.now()) return 'expirada'
    return 'ativa'
  }
  return 'aguardando_aceite'
}

export type DegustacaoUiResumo = {
  id: string
  status: string
  expira_em: string | null
  aceito_em: string | null
  plano_titulo: string | null
}

/** Estado já conhecido no card (metadata/comprovante) após aceite ou encerramento — evita flash do botão ACEITAR. */
export function mapDegustacaoUiDeDetalhesCanal(
  detalhes: Record<string, unknown> | null | undefined,
): DegustacaoUiResumo | null {
  if (!detalhes || typeof detalhes !== 'object') return null

  const id = String(detalhes.degustacao_id ?? '').trim()
  const aceito = detalhes.aceito === true
  const statusRaw = detalhes.status != null ? String(detalhes.status).toLowerCase().trim() : ''

  if (!aceito && statusRaw !== 'ativa' && statusRaw !== 'expirada' && statusRaw !== 'cancelada') {
    return null
  }

  const status =
    statusRaw === 'ativa' || statusRaw === 'expirada' || statusRaw === 'cancelada'
      ? statusRaw
      : aceito
        ? 'ativa'
        : 'aguardando_aceite'

  return {
    id,
    status,
    expira_em: detalhes.expira_em != null ? String(detalhes.expira_em) : null,
    aceito_em: detalhes.aceito_em != null ? String(detalhes.aceito_em) : null,
    plano_titulo: String(detalhes.plano_titulo ?? '').trim() || null,
  }
}

export function mensagemDegustacaoAtiva(
  expiraEm: string | null | undefined,
  planoTitulo?: string | null,
): string {
  const data = formatarDataDegustacaoPtBr(expiraEm)
  const plano = planoTitulo?.trim()
  if (plano) {
    return `Degustação do plano ${plano} ativa! Aproveite o período bonificado até ${data}.`
  }
  return `Degustação ativa! Aproveite o período bonificado até ${data}.`
}

export function mensagemDegustacaoExpirada(
  expiraEm: string | null | undefined,
  planoTitulo?: string | null,
): string {
  const data = formatarDataDegustacaoPtBr(expiraEm)
  const plano = planoTitulo?.trim()
  const sufixoPlano = plano ? ` do plano ${plano}` : ''
  return `O período de degustação${sufixoPlano} encerrou${data !== '—' ? ` em ${data}` : ''}. Escolha um plano para continuar utilizando os serviços do aplicativo.`
}

/** Mensagem informativa exibida no card após aceite/encerramento (preserva texto mesmo após assinatura de plano). */
export function mensagemInformativaDegustacaoCard(
  detalhes: Record<string, unknown> | null | undefined,
  degustacao: DegustacaoUiResumo | null | undefined,
  planoTitulo?: string | null,
): string | null {
  const fixa = detalhes?.mensagem_encerramento
  if (typeof fixa === 'string' && fixa.trim()) return fixa.trim()

  const estado = resolverEstadoDegustacaoUi(degustacao)
  if (estado === 'ativa') {
    return mensagemDegustacaoAtiva(degustacao?.expira_em, planoTitulo)
  }
  if (estado === 'expirada' || estado === 'cancelada') {
    const expira = degustacao?.expira_em ?? (detalhes?.expira_em != null ? String(detalhes.expira_em) : null)
    const aceito = detalhes?.aceito === true || Boolean(degustacao?.aceito_em)
    if (aceito || expira) {
      return mensagemDegustacaoExpirada(expira, planoTitulo)
    }
  }
  return null
}

/** Preserva no canal o texto de encerramento da degustação ao contratar plano pago. */
export async function encerrarDegustacaoCanalAposAssinatura(
  supabase: SupabaseClient,
  empresaId: string,
): Promise<void> {
  if (!empresaId) return

  const { data: degs, error } = await supabase
    .from('empresa_degustacoes')
    .select(
      'id, dias, status, canal_financeiro_id, expira_em, aceito_em, plano_id, planos ( nome, titulo )',
    )
    .eq('empresa_id', empresaId)
    .not('canal_financeiro_id', 'is', null)
    .in('status', ['ativa', 'expirada', 'cancelada'])

  if (error) {
    console.error('encerrarDegustacaoCanalAposAssinatura:', error)
    return
  }

  const agoraIso = new Date().toISOString()

  for (const deg of degs ?? []) {
    const canalId = deg.canal_financeiro_id != null ? String(deg.canal_financeiro_id) : ''
    if (!canalId) continue

    const planosJoin = deg.planos as { nome?: string; titulo?: string } | { nome?: string; titulo?: string }[] | null
    const planoInfo = Array.isArray(planosJoin) ? planosJoin[0] : planosJoin
    const planoTitulo = String(planoInfo?.titulo ?? planoInfo?.nome ?? 'Plano')
    const planoNome = String(planoInfo?.nome ?? planoTitulo)
    const planoId = deg.plano_id != null ? String(deg.plano_id) : ''
    const expiraEm = deg.expira_em != null ? String(deg.expira_em) : null
    const aceitoEm = deg.aceito_em != null ? String(deg.aceito_em) : agoraIso
    const mensagemEncerramento = mensagemDegustacaoExpirada(expiraEm, planoTitulo)

    const detalhesBase = metadataDegustacaoCanal({
      degustacaoId: String(deg.id),
      dias: Number(deg.dias) || 1,
      planoId,
      planoTitulo,
      planoNome,
      aceito: true,
      aceitoEm,
      expiraEm: expiraEm ?? undefined,
    })

    const meta = {
      ...detalhesBase,
      status: 'cancelada',
      mensagem_encerramento: mensagemEncerramento,
      visualizado_em: agoraIso,
    }

    const { error: upErr } = await supabase
      .from('canal_financeiro')
      .update({
        metadata: meta,
        comprovante_detalhes: meta,
        lida_por_empresa: true,
      })
      .eq('id', canalId)
      .eq('empresa_id', empresaId)

    if (upErr) console.error('encerrarDegustacaoCanalAposAssinatura update:', upErr)
  }
}

export function montarMensagemDegustacao(
  username: string,
  dias: number,
  planoTitulo: string,
): string {
  const handle = username.trim().replace(/^@+/, '')
  const user = handle ? `@${handle}` : '@usuario'
  const plano = planoTitulo.trim() || 'plano bonificado'
  return `Parabéns ${user}, você foi bonificado com ${dias} dias de degustação do plano ${plano}. Bem-vindo ao nosso ecossistema e torcemos para que faça bons negócios.

OBS: Após o período de degustação sua conta será bloqueada e voltará funcionar após a escolha de um novo plano.`
}

function servicosDePlanoRow(row: Record<string, unknown> | null | undefined): ServicoPlanoId[] {
  const servicosRaw = row?.servicos
  if (!Array.isArray(servicosRaw)) return []
  return servicosRaw.filter((s): s is ServicoPlanoId => typeof s === 'string')
}

export function metadataDegustacaoCanal(params: {
  degustacaoId: string
  dias: number
  planoId: string
  planoTitulo: string
  planoNome: string
  aceito?: boolean
  aceitoEm?: string | null
  expiraEm?: string | null
}): Record<string, unknown> {
  return {
    variant: 'degustacao',
    degustacao_id: params.degustacaoId,
    dias: params.dias,
    plano_id: params.planoId,
    plano_titulo: params.planoTitulo,
    plano_nome: params.planoNome,
    aceito: params.aceito ?? false,
    ...(params.aceitoEm ? { aceito_em: params.aceitoEm } : {}),
    ...(params.expiraEm ? { expira_em: params.expiraEm } : {}),
  }
}

export async function buscarServicosPlanoDegustacao(
  supabase: SupabaseClient,
  planoId: string | null | undefined,
): Promise<ServicoPlanoId[]> {
  if (!planoId) return buscarServicosPlanoBasico(supabase)

  const { data } = await supabase
    .from('planos')
    .select('servicos')
    .eq('id', planoId)
    .eq('ativo', true)
    .maybeSingle()

  const servicos = servicosDePlanoRow(data as Record<string, unknown> | null)
  if (servicos.length > 0) return servicos
  return buscarServicosPlanoBasico(supabase)
}

export async function buscarServicosPlanoBasico(supabase: SupabaseClient): Promise<ServicoPlanoId[]> {
  const { data } = await supabase
    .from('planos')
    .select('nome, titulo, servicos')
    .eq('ativo', true)

  const rows = data ?? []
  const basico =
    rows.find((r) => {
      const row = r as Record<string, unknown>
      const nome = normalizarPlanoSlug(String(row.nome ?? ''))
      const titulo = normalizarPlanoSlug(String(row.titulo ?? ''))
      return nome === 'basico' || titulo === 'basico'
    }) ?? rows[0]

  if (!basico) return ['pagina_rede_social']

  const servicosRaw = (basico as Record<string, unknown>).servicos
  if (!Array.isArray(servicosRaw)) return ['pagina_rede_social']
  return servicosRaw.filter((s): s is ServicoPlanoId => typeof s === 'string')
}

/** Degustações ativas por empresa (leitura em lote — guia turístico). */
export async function buscarMapaDegustacaoAtivaPorEmpresas(
  supabase: SupabaseClient,
  empresaIds: string[],
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>()
  const ids = [...new Set(empresaIds.filter(Boolean))]
  if (ids.length === 0) return map

  const agora = new Date().toISOString()
  const { data } = await supabase
    .from('empresa_degustacoes')
    .select('empresa_id, plano_id')
    .in('empresa_id', ids)
    .eq('status', 'ativa')
    .gt('expira_em', agora)

  for (const row of data ?? []) {
    map.set(String(row.empresa_id), row.plano_id != null ? String(row.plano_id) : null)
  }
  return map
}

export async function empresaDegustacaoAtiva(
  supabase: SupabaseClient,
  empresaId: string,
): Promise<DegustacaoEmpresaRow | null> {
  const agora = new Date().toISOString()
  const { data } = await supabase
    .from('empresa_degustacoes')
    .select('id, empresa_id, dias, status, canal_financeiro_id, plano_id, aceito_em, inicio_em, expira_em, planos ( titulo )')
    .eq('empresa_id', empresaId)
    .eq('status', 'ativa')
    .gt('expira_em', agora)
    .order('expira_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data?.id) return null

  const planosJoin = data.planos as { titulo?: string } | { titulo?: string }[] | null
  const planoTitulo = Array.isArray(planosJoin)
    ? planosJoin[0]?.titulo
    : planosJoin?.titulo

  return {
    id: String(data.id),
    empresa_id: String(data.empresa_id),
    dias: Number(data.dias),
    status: 'ativa',
    canal_financeiro_id: data.canal_financeiro_id != null ? String(data.canal_financeiro_id) : null,
    plano_id: data.plano_id != null ? String(data.plano_id) : null,
    plano_titulo: planoTitulo != null ? String(planoTitulo) : null,
    aceito_em: data.aceito_em != null ? String(data.aceito_em) : null,
    inicio_em: data.inicio_em != null ? String(data.inicio_em) : null,
    expira_em: data.expira_em != null ? String(data.expira_em) : null,
  }
}

export async function concederDegustacaoEmpresa(
  supabase: SupabaseClient,
  params: {
    empresaId: string
    empresaUsuarioId: string
    username: string
    dias: number
    planoId: string
    admUsuarioId: string
  },
): Promise<{ ok: boolean; error?: string; degustacaoId?: string }> {
  const dias = Math.floor(Number(params.dias))
  if (!Number.isFinite(dias) || dias < 1 || dias > 365) {
    return { ok: false, error: 'Período inválido (1 a 365 dias).' }
  }

  const planoId = params.planoId?.trim()
  if (!planoId) return { ok: false, error: 'Plano obrigatório para degustação.' }

  const { data: planoRow, error: planoErr } = await supabase
    .from('planos')
    .select('id, nome, titulo, ativo')
    .eq('id', planoId)
    .eq('ativo', true)
    .maybeSingle()

  if (planoErr || !planoRow?.id) {
    return { ok: false, error: 'Plano indisponível para degustação.' }
  }

  const planoTitulo = String(planoRow.titulo ?? planoRow.nome ?? 'Plano')
  const planoNome = String(planoRow.nome ?? planoTitulo)

  const { data: emp, error: empErr } = await supabase
    .from('empresas')
    .select('id, usuario_id, nome_usuario, status, docs_verificado, aprovado_em, verificado_em')
    .eq('id', params.empresaId)
    .maybeSingle()

  if (empErr || !emp?.id) return { ok: false, error: 'Empresa não encontrada.' }

  const { data: userRow } = await supabase
    .from('usuarios')
    .select('status')
    .eq('id', emp.usuario_id)
    .maybeSingle()

  if (
    !empresaRecursosLiberados(
      userRow?.status != null ? String(userRow.status) : null,
      {
        status: emp.status != null ? String(emp.status) : null,
        docs_verificado: Boolean(emp.docs_verificado),
        aprovado_em: emp.aprovado_em != null ? String(emp.aprovado_em) : null,
        verificado_em: emp.verificado_em != null ? String(emp.verificado_em) : null,
      },
    )
  ) {
    return { ok: false, error: 'Empresa precisa estar verificada e com cadastro liberado.' }
  }

  const { count: pendentes } = await supabase
    .from('empresa_degustacoes')
    .select('id', { count: 'exact', head: true })
    .eq('empresa_id', params.empresaId)
    .in('status', ['aguardando_aceite', 'ativa'])

  if (pendentes && pendentes > 0) {
    return { ok: false, error: 'Esta empresa já possui degustação pendente ou ativa.' }
  }

  const username = String(params.username || emp.nome_usuario || '').trim()
  const mensagem = montarMensagemDegustacao(username, dias, planoTitulo)

  const { data: degRow, error: degErr } = await supabase
    .from('empresa_degustacoes')
    .insert({
      empresa_id: params.empresaId,
      plano_id: planoId,
      dias,
      status: 'aguardando_aceite',
      concedido_por: params.admUsuarioId,
    })
    .select('id')
    .maybeSingle()

  if (degErr || !degRow?.id) {
    return { ok: false, error: degErr?.message ?? 'Falha ao registrar degustação.' }
  }

  const degustacaoId = String(degRow.id)
  const detalhesConvite = metadataDegustacaoCanal({
    degustacaoId,
    dias,
    planoId,
    planoTitulo,
    planoNome,
    aceito: false,
  })

  const canal = await inserirNotificacaoCanalFinanceiroEmpresa(supabase, {
    empresaUsuarioId: params.empresaUsuarioId,
    tipo: 'degustacao_plano',
    titulo: `Degustação — ${planoTitulo}`,
    mensagem,
    metadata: detalhesConvite,
    comprovanteDetalhes: detalhesConvite,
  })

  if (!canal.ok || !canal.id) {
    await supabase.from('empresa_degustacoes').delete().eq('id', degRow.id)
    return { ok: false, error: canal.error ?? 'Falha ao enviar convite no canal financeiro.' }
  }

  await supabase
    .from('empresa_degustacoes')
    .update({ canal_financeiro_id: canal.id, updated_at: new Date().toISOString() })
    .eq('id', degRow.id)

  return { ok: true, degustacaoId: String(degRow.id) }
}

export async function aceitarDegustacaoEmpresa(
  supabase: SupabaseClient,
  params: { degustacaoId: string; empresaUsuarioId: string },
): Promise<{ ok: boolean; error?: string }> {
  const { data: emp } = await supabase
    .from('empresas')
    .select('id, status, docs_verificado, aprovado_em, verificado_em')
    .eq('usuario_id', params.empresaUsuarioId)
    .maybeSingle()

  if (!emp?.id) return { ok: false, error: 'Empresa não encontrada.' }

  const { data: userRow } = await supabase
    .from('usuarios')
    .select('status')
    .eq('id', params.empresaUsuarioId)
    .maybeSingle()

  if (
    !empresaRecursosLiberados(
      userRow?.status != null ? String(userRow.status) : null,
      {
        status: emp.status != null ? String(emp.status) : null,
        docs_verificado: Boolean(emp.docs_verificado),
        aprovado_em: emp.aprovado_em != null ? String(emp.aprovado_em) : null,
        verificado_em: emp.verificado_em != null ? String(emp.verificado_em) : null,
      },
    )
  ) {
    return { ok: false, error: 'Cadastro precisa estar verificado e liberado para aceitar a degustação.' }
  }

  const { data: deg, error: degErr } = await supabase
    .from('empresa_degustacoes')
    .select('id, empresa_id, dias, status, canal_financeiro_id, plano_id, aceito_em, expira_em, planos ( nome, titulo )')
    .eq('id', params.degustacaoId)
    .eq('empresa_id', emp.id)
    .maybeSingle()

  if (degErr || !deg?.id) return { ok: false, error: 'Degustação não encontrada.' }

  const planosJoin = deg.planos as { nome?: string; titulo?: string } | { nome?: string; titulo?: string }[] | null
  const planoInfo = Array.isArray(planosJoin) ? planosJoin[0] : planosJoin
  const planoTitulo = String(planoInfo?.titulo ?? planoInfo?.nome ?? 'Plano')
  const planoNome = String(planoInfo?.nome ?? planoTitulo)
  const planoId = deg.plano_id != null ? String(deg.plano_id) : ''

  const sincronizarCanalDegustacao = async (
    aceitoEm: string,
    expiraEm: string,
  ) => {
    if (!deg.canal_financeiro_id) return
    const detalhesAtualizados = metadataDegustacaoCanal({
      degustacaoId: String(deg.id),
      dias: Number(deg.dias),
      planoId,
      planoTitulo,
      planoNome,
      aceito: true,
      aceitoEm,
      expiraEm,
    })
    const { error: canalErr } = await supabase
      .from('canal_financeiro')
      .update({
        metadata: { ...detalhesAtualizados, status: 'ativa', visualizado_em: aceitoEm },
        comprovante_detalhes: { ...detalhesAtualizados, status: 'ativa', visualizado_em: aceitoEm },
        lida_por_empresa: true,
      })
      .eq('id', deg.canal_financeiro_id)

    if (canalErr) {
      console.error('sincronizarCanalDegustacao:', canalErr)
    }
  }

  if (String(deg.status) === 'ativa') {
    await sincronizarCanalDegustacao(
      deg.aceito_em != null ? String(deg.aceito_em) : new Date().toISOString(),
      deg.expira_em != null ? String(deg.expira_em) : new Date().toISOString(),
    )
    await garantirCanaisEmpresaComunidade(supabase, String(emp.id))
    return { ok: true }
  }
  if (String(deg.status) !== 'aguardando_aceite') {
    return { ok: false, error: 'Esta degustação já foi respondida.' }
  }

  const agora = new Date()
  const expira = new Date(agora)
  expira.setDate(expira.getDate() + Number(deg.dias))

  const { error: upErr } = await supabase
    .from('empresa_degustacoes')
    .update({
      status: 'ativa',
      aceito_em: agora.toISOString(),
      inicio_em: agora.toISOString(),
      expira_em: expira.toISOString(),
      updated_at: agora.toISOString(),
    })
    .eq('id', deg.id)
    .eq('status', 'aguardando_aceite')

  if (upErr) return { ok: false, error: upErr.message }

  await sincronizarCanalDegustacao(agora.toISOString(), expira.toISOString())

  await garantirCanaisEmpresaComunidade(supabase, String(emp.id))

  return { ok: true }
}
