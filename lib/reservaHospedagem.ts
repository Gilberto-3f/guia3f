import type { SupabaseClient } from '@supabase/supabase-js'
import { pickFotoTurista } from '@/lib/turistaPreLiberacao'

export type FormaPagamentoReservaHospedagem = 'dinheiro' | 'pix' | 'cartao_deb_cred'

export const FORMAS_PAGAMENTO_RESERVA_HOSPEDAGEM: ReadonlyArray<{
  value: FormaPagamentoReservaHospedagem
  label: string
}> = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'PIX' },
  { value: 'cartao_deb_cred', label: 'Cartão DÉB/CRÉD' },
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
  turista_usuario_id: string | null
  data_checkin: string
  data_checkout: string
  status: string
  valor_estimado: number | null
  noites: number | null
  forma_pagamento: FormaPagamentoReservaHospedagem | null
  motivo_recusa: string | null
  respondido_em: string | null
  canal_financeiro_id: string | null
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
