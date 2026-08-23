import type { SupabaseClient } from '@supabase/supabase-js'

export type TuristaCompraTipo =
  | 'reserva_hospedagem'
  | 'compra_ticket'
  | 'mobilidade'
  | 'mobilidade_corrida'

export type TuristaCompraRow = {
  id: string
  turista_usuario_id: string
  tipo: TuristaCompraTipo | string
  referencia_id: string | null
  empresa_id: string | null
  profissional_usuario_id: string | null
  titulo: string
  descricao: string | null
  status: string
  metadata: Record<string, unknown>
  registrado_em: string
  visto_pelo_turista_em: string | null
  popup_exibido_em: string | null
  pendente: boolean
}

const TIPOS_SERVICOS = new Set(['mobilidade', 'mobilidade_corrida'])
const TIPOS_COMPRAS = new Set(['reserva_hospedagem', 'compra_ticket'])

function normalizarTipoMobilidade(tipo: string): string {
  if (tipo === 'mobilidade_corrida') return 'mobilidade'
  return tipo
}

function mapRow(raw: Record<string, unknown>): TuristaCompraRow {
  return {
    id: String(raw.id),
    turista_usuario_id: String(raw.turista_usuario_id),
    tipo: String(raw.tipo),
    referencia_id: raw.referencia_id != null ? String(raw.referencia_id) : null,
    empresa_id: raw.empresa_id != null ? String(raw.empresa_id) : null,
    profissional_usuario_id:
      raw.profissional_usuario_id != null ? String(raw.profissional_usuario_id) : null,
    titulo: String(raw.titulo ?? ''),
    descricao: raw.descricao != null ? String(raw.descricao) : null,
    status: String(raw.status ?? 'registrada'),
    metadata:
      raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata)
        ? (raw.metadata as Record<string, unknown>)
        : {},
    registrado_em: String(raw.registrado_em ?? raw.created_at ?? new Date().toISOString()),
    visto_pelo_turista_em:
      raw.visto_pelo_turista_em != null ? String(raw.visto_pelo_turista_em) : null,
    popup_exibido_em: raw.popup_exibido_em != null ? String(raw.popup_exibido_em) : null,
    pendente: raw.visto_pelo_turista_em == null && String(raw.status ?? '') !== 'pendente',
  }
}

export async function upsertCompraTurista(
  supabase: SupabaseClient,
  params: {
    turistaUsuarioId: string
    tipo: TuristaCompraTipo | string
    referenciaId?: string | null
    empresaId?: string | null
    profissionalUsuarioId?: string | null
    titulo: string
    descricao?: string | null
    status?: string
    metadata?: Record<string, unknown>
    resetVisto?: boolean
  },
): Promise<void> {
  const turistaId = String(params.turistaUsuarioId ?? '').trim()
  if (!turistaId) return

  const tipo = String(params.tipo ?? '').trim()
  const referenciaId = params.referenciaId != null ? String(params.referenciaId).trim() : null
  const payload = {
    turista_usuario_id: turistaId,
    tipo,
    referencia_id: referenciaId,
    empresa_id: params.empresaId ?? null,
    profissional_usuario_id: params.profissionalUsuarioId ?? null,
    titulo: params.titulo,
    descricao: params.descricao ?? null,
    status: params.status ?? 'registrada',
    metadata: params.metadata ?? {},
    registrado_em: new Date().toISOString(),
    ...(params.resetVisto ? { visto_pelo_turista_em: null, popup_exibido_em: null } : {}),
  }

  if (referenciaId) {
    const { data: existente } = await supabase
      .from('turista_compras')
      .select('id')
      .eq('turista_usuario_id', turistaId)
      .eq('tipo', tipo)
      .eq('referencia_id', referenciaId)
      .maybeSingle()

    if (existente?.id) {
      const { error } = await supabase.from('turista_compras').update(payload).eq('id', existente.id)
      if (error) {
        console.warn('[turistaCompras] update:', error.message)
        throw error
      }
      return
    }
  }

  const { error } = await supabase.from('turista_compras').insert(payload)
  if (error) {
    console.warn('[turistaCompras] insert:', error.message)
    throw error
  }
}

export async function sincronizarCompraReservaHospedagem(
  supabase: SupabaseClient,
  reserva: {
    id: string
    turista_usuario_id: string | null
    empresa_id: string
    data_checkin: string
    data_checkout: string
    noites?: number | null
    valor_estimado?: number | null
    forma_pagamento?: string | null
    motivo_recusa?: string | null
  },
  status: 'pendente' | 'confirmada' | 'cancelada',
  empresaNome: string,
): Promise<void> {
  const turistaId = reserva.turista_usuario_id != null ? String(reserva.turista_usuario_id) : ''
  if (!turistaId) return

  const checkin = reserva.data_checkin
  const checkout = reserva.data_checkout
  const resetVisto = status === 'confirmada' || status === 'cancelada'

  await upsertCompraTurista(supabase, {
    turistaUsuarioId: turistaId,
    tipo: 'reserva_hospedagem',
    referenciaId: String(reserva.id),
    empresaId: String(reserva.empresa_id),
    titulo: `Reserva — ${empresaNome}`,
    descricao: `Check-in ${formatarDataBr(checkin)} · Check-out ${formatarDataBr(checkout)}`,
    status,
    metadata: {
      data_checkin: checkin,
      data_checkout: checkout,
      noites: reserva.noites,
      valor_estimado: reserva.valor_estimado,
      forma_pagamento: reserva.forma_pagamento,
      motivo_recusa: reserva.motivo_recusa,
      empresa_nome: empresaNome,
    },
    resetVisto,
  })
}

function formatarDataBr(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-BR')
}

export async function registrarCompraTuristaUso(
  supabase: SupabaseClient,
  turistaUsuarioId: string,
  params: {
    tipo: string
    descricao: string
    empresaId?: string | null
    profissionalUsuarioId?: string | null
  },
): Promise<void> {
  const tipoRaw = String(params.tipo ?? '').trim()
  if (!tipoRaw) return

  const tipoNorm = normalizarTipoMobilidade(tipoRaw)
  let titulo = params.descricao
  if (tipoNorm === 'mobilidade') titulo = `Mobilidade — ${params.descricao}`
  else if (tipoRaw === 'compra_ticket') titulo = `Ticket — ${params.descricao}`
  else if (tipoRaw === 'reserva_hospedagem') titulo = `Hospedagem — ${params.descricao}`

  await upsertCompraTurista(supabase, {
    turistaUsuarioId,
    tipo: tipoRaw,
    referenciaId: `${tipoRaw}:${Date.now()}`,
    empresaId: params.empresaId ?? null,
    profissionalUsuarioId: params.profissionalUsuarioId ?? null,
    titulo,
    descricao: params.descricao,
    status: 'registrada',
    resetVisto: true,
  })
}

/** Corrida de mobilidade concluída → aba SERVIÇOS (Minhas compras). */
export async function registrarCompraTuristaCorridaMobilidade(
  supabase: SupabaseClient,
  params: {
    turistaUsuarioId: string
    solicitacaoId: string
    profissionalUsuarioId: string
    profissionalNome: string
    profissionalUsername?: string | null
    profissionalFotoUrl?: string | null
    origemNome?: string | null
    destinoNome?: string | null
    valor?: number | null
    pagamento?: string | null
    lugares?: number | null
    dataAgendada?: string | null
    modalidade?: string | null
    concluidoEm?: string | null
  },
): Promise<void> {
  const turistaId = String(params.turistaUsuarioId ?? '').trim()
  const solicitacaoId = String(params.solicitacaoId ?? '').trim()
  if (!turistaId || !solicitacaoId) return

  const username = String(params.profissionalUsername ?? '')
    .replace(/^@+/, '')
    .trim()
  const nome = String(params.profissionalNome ?? 'Profissional').trim() || 'Profissional'
  const origem = String(params.origemNome ?? '').trim() || '—'
  const destino = String(params.destinoNome ?? '').trim() || '—'
  const agendado = Boolean(params.dataAgendada)
  const valor =
    params.valor != null && Number.isFinite(Number(params.valor)) ? Number(params.valor) : null
  const lugares =
    params.lugares != null && Number.isFinite(Number(params.lugares))
      ? Number(params.lugares)
      : 1
  const concluidoEm = params.concluidoEm || new Date().toISOString()

  await upsertCompraTurista(supabase, {
    turistaUsuarioId: turistaId,
    tipo: 'mobilidade',
    referenciaId: solicitacaoId,
    profissionalUsuarioId: params.profissionalUsuarioId || null,
    titulo: nome,
    descricao: `${origem} → ${destino}`,
    status: 'registrada',
    metadata: {
      kind: 'mobilidade_corrida',
      solicitacao_id: solicitacaoId,
      profissional_nome: nome,
      profissional_username: username || null,
      profissional_foto_url: params.profissionalFotoUrl ?? null,
      origem_nome: origem,
      destino_nome: destino,
      valor_estimado: valor,
      pagamento: params.pagamento ?? null,
      lugares,
      data_agendada: params.dataAgendada ?? null,
      modalidade: params.modalidade ?? null,
      atendimento: agendado ? 'agendado' : 'imediato',
      concluido_em: concluidoEm,
    },
    resetVisto: true,
  })
}

export async function contarComprasTuristaPendentes(
  supabase: SupabaseClient,
  turistaUsuarioId: string,
): Promise<number> {
  const uid = String(turistaUsuarioId ?? '').trim()
  if (!uid) return 0

  const { data, error } = await supabase
    .from('turista_compras')
    .select('id, status, visto_pelo_turista_em')
    .eq('turista_usuario_id', uid)
    .is('visto_pelo_turista_em', null)
    .neq('status', 'pendente')

  if (error) {
    console.warn('[turistaCompras] contar pendentes:', error.message)
    return 0
  }
  return data?.length ?? 0
}

export async function listarComprasTurista(
  supabase: SupabaseClient,
  turistaUsuarioId: string,
  opts: { categoria?: 'servicos' | 'compras'; limit?: number } = {},
): Promise<TuristaCompraRow[]> {
  const uid = String(turistaUsuarioId ?? '').trim()
  if (!uid) return []

  const limit = opts.limit ?? 80
  const { data, error } = await supabase
    .from('turista_compras')
    .select('*')
    .eq('turista_usuario_id', uid)
    .order('registrado_em', { ascending: false })
    .limit(limit)

  if (error) {
    console.warn('[turistaCompras] listar:', error.message)
    return []
  }

  const rows = (data ?? []).map((r) => mapRow(r as Record<string, unknown>))
  const cat = opts.categoria
  if (cat === 'servicos') {
    return rows.filter((r) => TIPOS_SERVICOS.has(String(r.tipo)))
  }
  if (cat === 'compras') {
    return rows.filter((r) => TIPOS_COMPRAS.has(String(r.tipo)))
  }
  return rows
}

export async function marcarComprasTuristaComoVistas(
  supabase: SupabaseClient,
  turistaUsuarioId: string,
): Promise<void> {
  const uid = String(turistaUsuarioId ?? '').trim()
  if (!uid) return

  const now = new Date().toISOString()
  await supabase
    .from('turista_compras')
    .update({ visto_pelo_turista_em: now })
    .eq('turista_usuario_id', uid)
    .is('visto_pelo_turista_em', null)
    .neq('status', 'pendente')
}

export async function marcarPopupReservaConfirmadaExibido(
  supabase: SupabaseClient,
  compraId: string,
): Promise<void> {
  const id = String(compraId ?? '').trim()
  if (!id) return
  await supabase
    .from('turista_compras')
    .update({ popup_exibido_em: new Date().toISOString() })
    .eq('id', id)
}

export type PopupReservaConfirmadaPendente = {
  compraId: string
  empresaId: string
  empresaNome: string
  dataCheckin: string
  dataCheckout: string
}

export async function buscarPopupReservaConfirmadaPendente(
  supabase: SupabaseClient,
  turistaUsuarioId: string,
): Promise<PopupReservaConfirmadaPendente | null> {
  const uid = String(turistaUsuarioId ?? '').trim()
  if (!uid) return null

  const { data, error } = await supabase
    .from('turista_compras')
    .select('id, empresa_id, metadata, descricao')
    .eq('turista_usuario_id', uid)
    .eq('tipo', 'reserva_hospedagem')
    .eq('status', 'confirmada')
    .is('popup_exibido_em', null)
    .order('registrado_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data?.id || !data.empresa_id) return null

  const meta =
    data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata)
      ? (data.metadata as Record<string, unknown>)
      : {}

  return {
    compraId: String(data.id),
    empresaId: String(data.empresa_id),
    empresaNome: String(meta.empresa_nome ?? 'Hospedagem'),
    dataCheckin: String(meta.data_checkin ?? ''),
    dataCheckout: String(meta.data_checkout ?? ''),
  }
}
