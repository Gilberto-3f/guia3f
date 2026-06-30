import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import {
  atualizarCanalFinanceiroReservaRespondida,
  cancelarReservasPendentesConflitantes,
  carregarTuristaReservaMeta,
  marcarEmpresaHospedagemLotada,
  MOTIVO_CANCELAMENTO_AUTO,
  type ReservaHospedagemRow,
  usuarioGerenciaEmpresaHospedagem,
} from '@/lib/reservaHospedagem'
import { sincronizarCompraReservaHospedagem } from '@/lib/turistaCompras'

export async function POST(req: Request) {
  try {
    const session = await assertUserSession()
    if (!session.ok) return session.error

    const body = (await req.json()) as Record<string, unknown>
    const reservaId = String(body.reserva_id ?? '').trim()
    const acao = String(body.acao ?? '').trim()
    const motivoRecusa = body.motivo_recusa != null ? String(body.motivo_recusa).trim() : ''

    if (!reservaId || !['confirmar', 'recusar'].includes(acao)) {
      return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 })
    }

    if (acao === 'recusar' && !motivoRecusa) {
      return NextResponse.json({ error: 'Informe o motivo da recusa.' }, { status: 400 })
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

    if (String(reserva.status) !== 'pendente') {
      return NextResponse.json({ error: 'Esta solicitação já foi respondida.' }, { status: 400 })
    }

    const podeGerir =
      session.role === 'admin' ||
      (await usuarioGerenciaEmpresaHospedagem(adminDb, session.userId, String(reserva.empresa_id)))

    if (!podeGerir) {
      return NextResponse.json({ error: 'Sem permissão para responder esta reserva.' }, { status: 403 })
    }

    const { data: emp } = await adminDb
      .from('empresas')
      .select('nome_fantasia')
      .eq('id', reserva.empresa_id)
      .maybeSingle()

    const turistaId = reserva.turista_usuario_id != null ? String(reserva.turista_usuario_id) : ''
    const turistaMeta = turistaId ? await carregarTuristaReservaMeta(adminDb, turistaId) : null

    const now = new Date().toISOString()
    const novoStatus = acao === 'confirmar' ? 'confirmada' : 'cancelada'

    const { error: upErr } = await adminDb
      .from('reservas_hospedagem')
      .update({
        status: novoStatus,
        respondido_em: now,
        motivo_recusa: acao === 'recusar' ? motivoRecusa : null,
      })
      .eq('id', reservaId)
      .eq('status', 'pendente')

    if (upErr) {
      return NextResponse.json({ error: upErr.message ?? 'Não foi possível atualizar a reserva.' }, { status: 400 })
    }

    await atualizarCanalFinanceiroReservaRespondida(adminDb, {
      canalFinanceiroId: reserva.canal_financeiro_id,
      reserva,
      acao: acao as 'confirmar' | 'recusar',
      motivoRecusa: acao === 'recusar' ? motivoRecusa : null,
      turistaUsername: turistaMeta?.username,
      turistaNome: turistaMeta?.nome,
      turistaFotoUrl: turistaMeta?.fotoUrl ?? null,
      empresaNome: emp?.nome_fantasia != null ? String(emp.nome_fantasia) : '',
    })

    const empresaNome = emp?.nome_fantasia != null ? String(emp.nome_fantasia) : 'Hospedagem'
    await sincronizarCompraReservaHospedagem(
      adminDb,
      {
        ...reserva,
        motivo_recusa: acao === 'recusar' ? motivoRecusa : null,
      },
      novoStatus === 'confirmada' ? 'confirmada' : 'cancelada',
      empresaNome,
    )

    if (acao === 'confirmar') {
      await marcarEmpresaHospedagemLotada(adminDb, String(reserva.empresa_id))
    }

    if (acao === 'confirmar' && turistaId) {
      const canceladas = await cancelarReservasPendentesConflitantes(adminDb, {
        turistaUsuarioId: turistaId,
        reservaConfirmadaId: reservaId,
        empresaConfirmadaId: String(reserva.empresa_id),
        dataCheckin: String(reserva.data_checkin),
        dataCheckout: String(reserva.data_checkout),
      })

      for (const cancelada of canceladas) {
        const { data: empCancelada } = await adminDb
          .from('empresas')
          .select('nome_fantasia')
          .eq('id', cancelada.empresa_id)
          .maybeSingle()

        const nomeEmpCancelada =
          empCancelada?.nome_fantasia != null ? String(empCancelada.nome_fantasia) : 'Hospedagem'

        await atualizarCanalFinanceiroReservaRespondida(adminDb, {
          canalFinanceiroId: cancelada.canal_financeiro_id,
          reserva: cancelada,
          acao: 'recusar',
          motivoRecusa: MOTIVO_CANCELAMENTO_AUTO,
          turistaUsername: turistaMeta?.username,
          turistaNome: turistaMeta?.nome,
          turistaFotoUrl: turistaMeta?.fotoUrl ?? null,
          empresaNome: nomeEmpCancelada,
        })

        await sincronizarCompraReservaHospedagem(
          adminDb,
          { ...cancelada, motivo_recusa: MOTIVO_CANCELAMENTO_AUTO },
          'cancelada',
          nomeEmpCancelada,
        )
      }
    }

    return NextResponse.json({ ok: true, status: novoStatus })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
