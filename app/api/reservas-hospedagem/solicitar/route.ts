import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import {
  carregarTuristaReservaMeta,
  criarAvisoCanalFinanceiroReservaHospedagem,
} from '@/lib/reservaHospedagem'
import { sincronizarCompraReservaHospedagem } from '@/lib/turistaCompras'

export async function POST(req: Request) {
  try {
    const session = await assertUserSession()
    if (!session.ok) return session.error

    const body = (await req.json()) as Record<string, unknown>
    const empresaId = String(body.empresa_id ?? '').trim()
    const checkin = String(body.data_checkin ?? '').trim()
    const checkout = String(body.data_checkout ?? '').trim()
    const noites = Number(body.noites)
    const valorEstimado = Number(body.valor_estimado)
    const formaRaw = String(body.forma_pagamento ?? '').trim()
    const formasValidas = new Set(['dinheiro', 'pix', 'cartao_deb_cred'])

    if (!empresaId || !checkin || !checkout || !Number.isFinite(noites) || noites <= 0) {
      return NextResponse.json({ error: 'Dados da reserva inválidos.' }, { status: 400 })
    }

    if (!formasValidas.has(formaRaw)) {
      return NextResponse.json({ error: 'Selecione a forma de pagamento.' }, { status: 400 })
    }

    let adminDb
    try {
      adminDb = createSupabaseAdmin()
    } catch {
      return NextResponse.json({ error: 'server_config' }, { status: 503 })
    }

    const { data: emp } = await adminDb
      .from('empresas')
      .select('id, nome_fantasia, categoria, somente_anfitriao, status')
      .eq('id', empresaId)
      .maybeSingle()

    if (!emp?.id) {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    }

    const cat = String(emp.categoria ?? '').trim()
    if (cat !== 'Hospedagem' && !emp.somente_anfitriao) {
      return NextResponse.json({ error: 'Reserva disponível apenas para hospedagem.' }, { status: 400 })
    }

    const turistaMeta = await carregarTuristaReservaMeta(adminDb, session.userId)

    const { data: reserva, error: insErr } = await adminDb
      .from('reservas_hospedagem')
      .insert({
        empresa_id: empresaId,
        turista_usuario_id: session.userId,
        data_checkin: checkin,
        data_checkout: checkout,
        status: 'pendente',
        valor_estimado: Number.isFinite(valorEstimado) ? valorEstimado : null,
        noites,
        forma_pagamento: formaRaw,
      })
      .select('id')
      .single()

    if (insErr || !reserva?.id) {
      return NextResponse.json({ error: insErr?.message ?? 'Não foi possível registrar a solicitação.' }, { status: 400 })
    }

    const aviso = await criarAvisoCanalFinanceiroReservaHospedagem(adminDb, {
      reservaId: String(reserva.id),
      empresaId,
      turistaUsuarioId: session.userId,
      turistaUsername: turistaMeta.username,
      turistaNome: turistaMeta.nome,
      turistaFotoUrl: turistaMeta.fotoUrl,
      empresaNome: String(emp.nome_fantasia ?? 'Hospedagem'),
      dataCheckin: checkin,
      dataCheckout: checkout,
      noites,
      valorEstimado: Number.isFinite(valorEstimado) ? valorEstimado : 0,
      formaPagamento: formaRaw as 'dinheiro' | 'pix' | 'cartao_deb_cred',
    })

    if (aviso.ok && aviso.canalFinanceiroId) {
      await adminDb
        .from('reservas_hospedagem')
        .update({ canal_financeiro_id: aviso.canalFinanceiroId })
        .eq('id', reserva.id)
    }

    await sincronizarCompraReservaHospedagem(
      adminDb,
      {
        id: String(reserva.id),
        turista_usuario_id: session.userId,
        empresa_id: empresaId,
        data_checkin: checkin,
        data_checkout: checkout,
        noites,
        valor_estimado: Number.isFinite(valorEstimado) ? valorEstimado : null,
        forma_pagamento: formaRaw,
      },
      'pendente',
      String(emp.nome_fantasia ?? 'Hospedagem'),
    )

    return NextResponse.json({ ok: true, reserva_id: reserva.id })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
