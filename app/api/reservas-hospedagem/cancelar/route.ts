import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import {
  type ReservaHospedagemRow,
} from '@/lib/reservaHospedagem'
import { sincronizarCompraReservaHospedagem } from '@/lib/turistaCompras'

/** Turista cancela a própria solicitação/reserva de hospedagem. */
export async function POST(req: Request) {
  try {
    const session = await assertUserSession()
    if (!session.ok) return session.error

    if (session.role !== 'turista' && session.role !== 'admin') {
      return NextResponse.json({ error: 'Apenas o turista pode cancelar a reserva.' }, { status: 403 })
    }

    const body = (await req.json()) as Record<string, unknown>
    const reservaId = String(body.reserva_id ?? '').trim()
    if (!reservaId) {
      return NextResponse.json({ error: 'reserva_id obrigatório.' }, { status: 400 })
    }

    let adminDb
    try {
      adminDb = createSupabaseAdmin()
    } catch {
      return NextResponse.json({ error: 'server_config' }, { status: 503 })
    }

    const { data: reservaRaw, error: loadErr } = await adminDb
      .from('reservas_hospedagem')
      .select('*')
      .eq('id', reservaId)
      .maybeSingle()

    if (loadErr || !reservaRaw) {
      return NextResponse.json({ error: 'Reserva não encontrada.' }, { status: 404 })
    }

    const reserva = reservaRaw as ReservaHospedagemRow
    const turistaId = reserva.turista_usuario_id != null ? String(reserva.turista_usuario_id) : ''

    if (session.role !== 'admin' && turistaId !== session.userId) {
      return NextResponse.json({ error: 'Sem permissão para cancelar esta reserva.' }, { status: 403 })
    }

    const statusAtual = String(reserva.status ?? '')
    if (statusAtual !== 'pendente' && statusAtual !== 'confirmada') {
      return NextResponse.json({ error: 'Esta reserva não pode mais ser cancelada.' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const { error: upErr } = await adminDb
      .from('reservas_hospedagem')
      .update({
        status: 'cancelada',
        respondido_em: now,
        motivo_recusa: 'Cancelada pelo turista',
      })
      .eq('id', reservaId)
      .in('status', ['pendente', 'confirmada'])

    if (upErr) {
      return NextResponse.json({ error: upErr.message ?? 'Não foi possível cancelar.' }, { status: 400 })
    }

    const { data: emp } = await adminDb
      .from('empresas')
      .select('nome_fantasia')
      .eq('id', reserva.empresa_id)
      .maybeSingle()

    const empresaNome = emp?.nome_fantasia != null ? String(emp.nome_fantasia) : 'Hospedagem'

    const metadata = {
      reserva_id: reserva.id,
      turista_usuario_id: reserva.turista_usuario_id,
      empresa_id: reserva.empresa_id,
      empresa_nome: empresaNome,
      data_checkin: reserva.data_checkin,
      data_checkout: reserva.data_checkout,
      noites: reserva.noites,
      valor_estimado: reserva.valor_estimado,
      forma_pagamento: reserva.forma_pagamento ?? null,
      respondido: 'cancelada_turista',
      cancelado_por: 'turista',
      motivo_recusa: 'Cancelada pelo turista',
    }

    const titulo = 'Solicitação Cancelada'
    const mensagem = 'Turista cancelou sua solicitação de reserva!'

    if (reserva.canal_financeiro_id) {
      await adminDb
        .from('canal_financeiro')
        .update({
          titulo,
          mensagem,
          metadata,
          lida_por_empresa: false,
          lida_por_profissional: false,
        })
        .eq('id', reserva.canal_financeiro_id)
    } else {
      await adminDb.from('canal_financeiro').insert({
        empresa_id: reserva.empresa_id,
        profissional_id: null,
        tipo: 'reserva_hospedagem',
        titulo,
        mensagem,
        valor: reserva.valor_estimado,
        lida_por_empresa: false,
        lida_por_profissional: false,
        metadata,
      })
    }

    await sincronizarCompraReservaHospedagem(
      adminDb,
      {
        id: String(reserva.id),
        turista_usuario_id: turistaId || null,
        empresa_id: String(reserva.empresa_id),
        data_checkin: String(reserva.data_checkin),
        data_checkout: String(reserva.data_checkout),
        noites: reserva.noites,
        valor_estimado: reserva.valor_estimado,
        forma_pagamento: reserva.forma_pagamento,
        motivo_recusa: 'Cancelada pelo turista',
      },
      'cancelada',
      empresaNome,
    )

    // Calendário libera automaticamente: ocupação só conta pendente/confirmada.
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
