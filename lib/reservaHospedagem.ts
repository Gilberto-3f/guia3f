import type { SupabaseClient } from '@supabase/supabase-js'
import { pickFotoTurista } from '@/lib/turistaPreLiberacao'

export type FormaPagamentoReservaHospedagem =
  | 'dinheiro'
  | 'pix'
  | 'cartao_deb_cred'
  | 'cartao_credito'
  | 'cartao_debito'

export const FORMAS_PAGAMENTO_RESERVA_HOSPEDAGEM: ReadonlyArray<{
  value: FormaPagamentoReservaHospedagem
  label: string
}> = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'PIX' },
  { value: 'cartao_credito', label: 'Cartão de Crédito' },
  { value: 'cartao_debito', label: 'Cartão de Débito' },
  { value: 'cartao_deb_cred', label: 'Cartão (Débito ou Crédito)' },
]

export function rotuloFormaPagamentoReservaHospedagem(
  forma: string | null | undefined,
): string | null {
  const hit = FORMAS_PAGAMENTO_RESERVA_HOSPEDAGEM.find((f) => f.value === forma)
  return hit?.label ?? null
}

export type ReservaHospedagemRow = {
  id: string
  empresa_id: string
  acomodacao_id?: string | null
  turista_usuario_id: string | null
  data_checkin: string
  data_checkout: string
  status: string
  valor_estimado: number | null
  noites: number | null
  numero_hospedes?: number | null
  forma_pagamento: FormaPagamentoReservaHospedagem | null
  motivo_recusa: string | null
  respondido_em: string | null
  canal_financeiro_id: string | null
  pos_checkout_status?: string | null
  created_at: string
}

/** Empresa do segmento Hospedagem (página anfitrião). */
export function empresaEhHospedagemAnfitriao(empresa: {
  categoria?: string | null
  somente_anfitriao?: boolean | null
}): boolean {
  if (Boolean(empresa.somente_anfitriao)) return true
  return String(empresa.categoria ?? '').trim() === 'Hospedagem'
}

/** Turista com reserva confirmada e ainda válida (check-out >= hoje). */
export async function turistaTemReservaHospedagemConfirmada(
  supabase: SupabaseClient,
  empresaId: string,
  turistaUsuarioId: string,
): Promise<boolean> {
  const empId = String(empresaId ?? '').trim()
  const uid = String(turistaUsuarioId ?? '').trim()
  if (!empId || !uid) return false

  const hoje = new Date().toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('reservas_hospedagem')
    .select('id')
    .eq('empresa_id', empId)
    .eq('turista_usuario_id', uid)
    .eq('status', 'confirmada')
    .gte('data_checkout', hoje)
    .limit(1)

  if (error) {
    console.error('[reservaHospedagem] turistaTemReservaConfirmada:', error)
    return false
  }
  return (data?.length ?? 0) > 0
}

export type ReservaHospedagemPendenteResumo = {
  id: string
  empresa_id: string
  data_checkin: string
  data_checkout: string
  noites: number | null
  canal_financeiro_id: string | null
}

/** Períodos [check-in, check-out) com sobreposição de diárias. */
export function reservasHospedagemDatasSobrepoem(
  checkinA: string,
  checkoutA: string,
  checkinB: string,
  checkoutB: string,
): boolean {
  const a0 = String(checkinA).slice(0, 10)
  const a1 = String(checkoutA).slice(0, 10)
  const b0 = String(checkinB).slice(0, 10)
  const b1 = String(checkoutB).slice(0, 10)
  if (!a0 || !a1 || !b0 || !b1) return false
  return a0 < b1 && b0 < a1
}

/** Reserva pendente do turista nesta empresa (aguardando anfitrião). */
export async function buscarReservaPendenteEmpresa(
  supabase: SupabaseClient,
  turistaUsuarioId: string,
  empresaId: string,
): Promise<ReservaHospedagemPendenteResumo | null> {
  const uid = String(turistaUsuarioId ?? '').trim()
  const empId = String(empresaId ?? '').trim()
  if (!uid || !empId) return null

  const { data, error } = await supabase
    .from('reservas_hospedagem')
    .select('id, empresa_id, data_checkin, data_checkout, noites, canal_financeiro_id')
    .eq('turista_usuario_id', uid)
    .eq('empresa_id', empId)
    .eq('status', 'pendente')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data?.id) return null
  return data as ReservaHospedagemPendenteResumo
}

/** Reservas pendentes do turista em outras empresas de hospedagem. */
export async function listarReservasPendentesOutrasEmpresas(
  supabase: SupabaseClient,
  turistaUsuarioId: string,
  empresaIdAtual: string,
): Promise<ReservaHospedagemPendenteResumo[]> {
  const uid = String(turistaUsuarioId ?? '').trim()
  const empId = String(empresaIdAtual ?? '').trim()
  if (!uid) return []

  const { data, error } = await supabase
    .from('reservas_hospedagem')
    .select('id, empresa_id, data_checkin, data_checkout, noites, canal_financeiro_id')
    .eq('turista_usuario_id', uid)
    .eq('status', 'pendente')
    .neq('empresa_id', empId)
    .order('created_at', { ascending: false })

  if (error) return []
  return (data ?? []) as ReservaHospedagemPendenteResumo[]
}

export function algumaReservaPendenteConflitaComPeriodo(
  pendentes: ReservaHospedagemPendenteResumo[],
  checkin: string,
  checkout: string,
): boolean {
  return pendentes.some((r) =>
    reservasHospedagemDatasSobrepoem(r.data_checkin, r.data_checkout, checkin, checkout),
  )
}

const MOTIVO_CANCELAMENTO_AUTO =
  'Cancelada automaticamente: outra reserva confirmada para o mesmo período.'

/** Cancela reservas pendentes conflitantes em outras empresas após confirmação. */
export async function cancelarReservasPendentesConflitantes(
  supabase: SupabaseClient,
  params: {
    turistaUsuarioId: string
    reservaConfirmadaId: string
    empresaConfirmadaId: string
    dataCheckin: string
    dataCheckout: string
  },
): Promise<ReservaHospedagemRow[]> {
  const uid = String(params.turistaUsuarioId ?? '').trim()
  if (!uid) return []

  const { data: pendentesRaw } = await supabase
    .from('reservas_hospedagem')
    .select('*')
    .eq('turista_usuario_id', uid)
    .eq('status', 'pendente')
    .neq('id', params.reservaConfirmadaId)
    .neq('empresa_id', params.empresaConfirmadaId)

  const pendentes = (pendentesRaw ?? []) as ReservaHospedagemRow[]
  const conflitantes = pendentes.filter((r) =>
    reservasHospedagemDatasSobrepoem(
      r.data_checkin,
      r.data_checkout,
      params.dataCheckin,
      params.dataCheckout,
    ),
  )

  if (conflitantes.length === 0) return []

  const now = new Date().toISOString()
  const canceladas: ReservaHospedagemRow[] = []

  for (const r of conflitantes) {
    const { error } = await supabase
      .from('reservas_hospedagem')
      .update({
        status: 'cancelada',
        respondido_em: now,
        motivo_recusa: MOTIVO_CANCELAMENTO_AUTO,
      })
      .eq('id', r.id)
      .eq('status', 'pendente')

    if (!error) canceladas.push(r)
  }

  return canceladas
}

export { MOTIVO_CANCELAMENTO_AUTO }

const MOTIVO_CONSOLIDACAO_RESERVA =
  'Consolidada: uma solicitação por período de hospedagem.'

function noitesEntreDatas(checkin: string, checkout: string): number {
  const inicio = new Date(`${checkin}T12:00:00`)
  const fim = new Date(`${checkout}T12:00:00`)
  const diff = fim.getTime() - inicio.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

/** Remove reservas/cards pendentes duplicados (ex.: um por diária) — mantém o período mais longo. */
export async function consolidarReservasPendentesDuplicadas(
  supabase: SupabaseClient,
  turistaUsuarioId: string,
  empresaId: string,
): Promise<void> {
  const uid = String(turistaUsuarioId ?? '').trim()
  const empId = String(empresaId ?? '').trim()
  if (!uid || !empId) return

  const { data: pendentes } = await supabase
    .from('reservas_hospedagem')
    .select('id, data_checkin, data_checkout, noites, canal_financeiro_id, created_at')
    .eq('turista_usuario_id', uid)
    .eq('empresa_id', empId)
    .eq('status', 'pendente')
    .order('created_at', { ascending: false })

  const rows = pendentes ?? []
  if (rows.length <= 1) {
    await limparCanaisReservaHospedagemPendentesDuplicados(supabase, empId, uid, rows[0]?.id ?? null, rows[0]?.canal_financeiro_id ?? null)
    return
  }

  const ordenadas = [...rows].sort((a, b) => {
    const noitesA = Number(a.noites) || noitesEntreDatas(String(a.data_checkin), String(a.data_checkout))
    const noitesB = Number(b.noites) || noitesEntreDatas(String(b.data_checkin), String(b.data_checkout))
    if (noitesB !== noitesA) return noitesB - noitesA
    return new Date(String(b.created_at ?? 0)).getTime() - new Date(String(a.created_at ?? 0)).getTime()
  })

  const manter = ordenadas[0]
  const cancelar = ordenadas.slice(1)
  const now = new Date().toISOString()

  for (const r of cancelar) {
    await supabase
      .from('reservas_hospedagem')
      .update({
        status: 'cancelada',
        motivo_recusa: MOTIVO_CONSOLIDACAO_RESERVA,
        respondido_em: now,
      })
      .eq('id', r.id)
      .eq('status', 'pendente')

    if (r.canal_financeiro_id) {
      await supabase.from('canal_financeiro').delete().eq('id', r.canal_financeiro_id)
    }
  }

  await limparCanaisReservaHospedagemPendentesDuplicados(
    supabase,
    empId,
    uid,
    manter?.id != null ? String(manter.id) : null,
    manter?.canal_financeiro_id != null ? String(manter.canal_financeiro_id) : null,
  )
}

async function limparCanaisReservaHospedagemPendentesDuplicados(
  supabase: SupabaseClient,
  empresaId: string,
  turistaUsuarioId: string,
  reservaManterId: string | null,
  canalManterId: string | null,
): Promise<void> {
  const { data } = await supabase
    .from('canal_financeiro')
    .select('id, metadata')
    .eq('empresa_id', empresaId)
    .eq('tipo', 'reserva_hospedagem')

  for (const row of data ?? []) {
    const canalId = String(row.id)
    if (canalManterId && canalId === canalManterId) continue

    const meta =
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {}
    if (String(meta.turista_usuario_id ?? '') !== turistaUsuarioId) continue
    if (String(meta.respondido ?? '').trim()) continue

    const reservaId = String(meta.reserva_id ?? '').trim()
    if (reservaManterId && reservaId && reservaId === reservaManterId) continue

    await supabase.from('canal_financeiro').delete().eq('id', canalId)
  }
}

/** Evita cards repetidos no canal financeiro (mesma reserva ou mesma solicitação pendente). */
export function dedupeItensCanalReservaHospedagem<
  T extends { id: string; tipo: string; metadata?: Record<string, unknown> },
>(itens: T[]): T[] {
  const reservaVista = new Set<string>()
  const pendenteTuristaEmpresa = new Set<string>()
  const out: T[] = []

  for (const item of itens) {
    if (item.tipo !== 'reserva_hospedagem') {
      out.push(item)
      continue
    }

    const meta = item.metadata ?? {}
    const reservaId = String(meta.reserva_id ?? '').trim()
    const respondido = String(meta.respondido ?? '').trim()

    if (reservaId) {
      if (reservaVista.has(reservaId)) continue
      reservaVista.add(reservaId)
      out.push(item)
      continue
    }

    if (!respondido) {
      const chave = `${String(meta.turista_usuario_id ?? '')}|${String(meta.empresa_id ?? '')}`
      if (pendenteTuristaEmpresa.has(chave)) continue
      pendenteTuristaEmpresa.add(chave)
    }

    out.push(item)
  }

  return out
}

/** Após confirmação pelo anfitrião, marca a hospedagem como lotada na página da empresa. */
export async function marcarEmpresaHospedagemLotada(
  supabase: SupabaseClient,
  empresaId: string,
): Promise<void> {
  const empId = String(empresaId ?? '').trim()
  if (!empId) return

  await supabase.from('empresas').update({ hospedagem_disponibilidade: 'lotado' }).eq('id', empId)
}

function formatarDataBr(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-BR')
}

export async function criarAvisoCanalFinanceiroReservaHospedagem(
  supabase: SupabaseClient,
  params: {
    reservaId: string
    empresaId: string
    turistaUsuarioId: string
    turistaUsername: string
    turistaNome: string
    turistaFotoUrl?: string | null
    empresaNome: string
    dataCheckin: string
    dataCheckout: string
    noites: number
    valorEstimado: number
    formaPagamento: FormaPagamentoReservaHospedagem
  },
): Promise<{ ok: boolean; canalFinanceiroId?: string; error?: string }> {
  const checkin = formatarDataBr(params.dataCheckin)
  const checkout = formatarDataBr(params.dataCheckout)
  const formaLabel = rotuloFormaPagamentoReservaHospedagem(params.formaPagamento) ?? params.formaPagamento
  const mensagem = `${params.turistaNome} (@${params.turistaUsername}) solicitou reserva de ${params.noites} noite(s) (${checkin} → ${checkout}). Valor estimado: R$ ${params.valorEstimado.toFixed(2)}. Forma de pagamento: ${formaLabel}.`

  const metadata = {
    reserva_id: params.reservaId,
    turista_usuario_id: params.turistaUsuarioId,
    turista_username: params.turistaUsername,
    turista_nome: params.turistaNome,
    turista_foto_url: params.turistaFotoUrl ?? null,
    empresa_id: params.empresaId,
    empresa_nome: params.empresaNome,
    data_checkin: params.dataCheckin,
    data_checkout: params.dataCheckout,
    noites: params.noites,
    valor_estimado: params.valorEstimado,
    forma_pagamento: params.formaPagamento,
    respondido: '',
  }

  const canalExistenteId = await buscarCanalReservaHospedagemPendente(
    supabase,
    params.empresaId,
    params.turistaUsuarioId,
  )

  if (canalExistenteId) {
    const { error: upErr } = await supabase
      .from('canal_financeiro')
      .update({
        titulo: 'Solicitação de reserva',
        mensagem,
        valor: params.valorEstimado,
        lida_por_profissional: false,
        lida_por_empresa: false,
        metadata,
      })
      .eq('id', canalExistenteId)

    if (upErr) return { ok: false, error: upErr.message ?? 'canal_financeiro_falhou' }
    return { ok: true, canalFinanceiroId: canalExistenteId }
  }

  const { data, error } = await supabase
    .from('canal_financeiro')
    .insert({
      empresa_id: params.empresaId,
      profissional_id: null,
      tipo: 'reserva_hospedagem',
      titulo: 'Solicitação de reserva',
      mensagem,
      valor: params.valorEstimado,
      lida_por_profissional: false,
      lida_por_empresa: false,
      metadata,
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    return { ok: false, error: error?.message ?? 'canal_financeiro_falhou' }
  }
  return { ok: true, canalFinanceiroId: String(data.id) }
}

async function buscarCanalReservaHospedagemPendente(
  supabase: SupabaseClient,
  empresaId: string,
  turistaUsuarioId: string,
): Promise<string | null> {
  const empId = String(empresaId ?? '').trim()
  const uid = String(turistaUsuarioId ?? '').trim()
  if (!empId || !uid) return null

  const { data } = await supabase
    .from('canal_financeiro')
    .select('id, metadata')
    .eq('empresa_id', empId)
    .eq('tipo', 'reserva_hospedagem')
    .order('created_at', { ascending: false })

  for (const row of data ?? []) {
    const meta =
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {}
    if (String(meta.turista_usuario_id ?? '') !== uid) continue
    if (String(meta.respondido ?? '').trim()) continue
    return String(row.id)
  }

  return null
}

export async function atualizarCanalFinanceiroReservaRespondida(
  supabase: SupabaseClient,
  params: {
    canalFinanceiroId: string | null
    reserva: ReservaHospedagemRow
    acao: 'confirmar' | 'recusar'
    motivoRecusa?: string | null
    turistaUsername?: string
    turistaNome?: string
    turistaFotoUrl?: string | null
    empresaNome?: string
  },
): Promise<void> {
  const respondido = params.acao === 'confirmar' ? 'confirmada' : 'recusada'
  const turistaUsername = String(params.turistaUsername ?? '').trim() || 'turista'
  const turistaNome = String(params.turistaNome ?? '').trim() || 'Turista'

  const metadata = {
    reserva_id: params.reserva.id,
    turista_usuario_id: params.reserva.turista_usuario_id,
    turista_username: turistaUsername,
    turista_nome: turistaNome,
    turista_foto_url: params.turistaFotoUrl ?? null,
    empresa_id: params.reserva.empresa_id,
    empresa_nome: params.empresaNome ?? '',
    data_checkin: params.reserva.data_checkin,
    data_checkout: params.reserva.data_checkout,
    noites: params.reserva.noites,
    valor_estimado: params.reserva.valor_estimado,
    forma_pagamento: params.reserva.forma_pagamento ?? null,
    respondido,
    motivo_recusa: params.motivoRecusa ?? null,
  }

  const titulo = params.acao === 'confirmar' ? 'Reserva confirmada' : 'Reserva recusada'

  const checkin = formatarDataBr(params.reserva.data_checkin)
  const checkout = formatarDataBr(params.reserva.data_checkout)
  const mensagemBase = `${turistaNome} (@${turistaUsername}) — ${checkin} → ${checkout}`
  const mensagem =
    params.acao === 'confirmar'
      ? `Reserva confirmada: ${mensagemBase}.`
      : `Reserva recusada: ${mensagemBase}.${params.motivoRecusa ? ` Motivo: ${params.motivoRecusa}` : ''}`

  if (params.canalFinanceiroId) {
    await supabase
      .from('canal_financeiro')
      .update({
        titulo,
        mensagem,
        metadata,
        lida_por_empresa: true,
        lida_por_profissional: false,
      })
      .eq('id', params.canalFinanceiroId)
    return
  }

  await supabase.from('canal_financeiro').insert({
    empresa_id: params.reserva.empresa_id,
    profissional_id: null,
    tipo: 'reserva_hospedagem',
    titulo,
    mensagem,
    valor: params.reserva.valor_estimado,
    lida_por_empresa: true,
    lida_por_profissional: false,
    metadata,
  })
}

export async function carregarTuristaReservaMeta(
  supabase: SupabaseClient,
  turistaUsuarioId: string,
): Promise<{ username: string; nome: string; fotoUrl: string | null }> {
  const uid = String(turistaUsuarioId).trim()

  const [{ data: u }, { data: t }] = await Promise.all([
    supabase.from('usuarios').select('username').eq('id', uid).maybeSingle(),
    supabase.from('turistas').select('nome, nome_usuario, foto_perfil_url, foto_url').eq('usuario_id', uid).maybeSingle(),
  ])

  const username =
    String(u?.username ?? '').trim().replace(/^@+/, '') ||
    String(t?.nome_usuario ?? '').trim().replace(/^@+/, '') ||
    'turista'
  const nome = String(t?.nome ?? '').trim() || 'Turista'
  const fotoUrl = pickFotoTurista(t)

  return { username, nome, fotoUrl }
}

/** Gestor da empresa de hospedagem (dono empresa ou profissional anfitrião). */
export async function usuarioGerenciaEmpresaHospedagem(
  adminDb: SupabaseClient,
  usuarioId: string,
  empresaId: string,
): Promise<boolean> {
  const { data: emp } = await adminDb
    .from('empresas')
    .select('id, usuario_id, somente_anfitriao')
    .eq('id', empresaId)
    .maybeSingle()

  if (!emp?.id) return false
  if (String(emp.usuario_id) === usuarioId) return true

  const { data: prof } = await adminDb
    .from('profissionais')
    .select('empresa_hospedagem_id')
    .eq('usuario_id', usuarioId)
    .maybeSingle()

  return prof?.empresa_hospedagem_id != null && String(prof.empresa_hospedagem_id) === String(emp.id)
}
