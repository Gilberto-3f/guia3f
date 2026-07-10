import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import {
  type ReservaHospedagemRow,
  usuarioGerenciaEmpresaHospedagem,
} from '@/lib/reservaHospedagem'

/** Anfitrião responde o status da acomodação no dia do check-out. */
export async function POST(req: Request) {
  try {
    const session = await assertUserSession()
    if (!session.ok) return session.error

    const body = (await req.json()) as Record<string, unknown>
    const reservaId = String(body.reserva_id ?? '').trim()
    const status = String(body.status ?? '').trim()

    if (!reservaId || !['disponivel', 'ocupado'].includes(status)) {
      return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 })
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

    if (String(reserva.status) !== 'confirmada') {
      return NextResponse.json({ error: 'Reserva precisa estar confirmada.' }, { status: 400 })
    }

    if (reserva.pos_checkout_status) {
      return NextResponse.json({ error: 'Status de check-out já registrado.' }, { status: 400 })
    }

    const hoje = new Date().toISOString().slice(0, 10)
    const checkout = String(reserva.data_checkout).slice(0, 10)
    if (hoje < checkout) {
      return NextResponse.json(
        { error: 'O check-out só pode ser respondido a partir da data de saída.' },
        { status: 400 },
      )
    }

    const podeGerir =
      session.role === 'admin' ||
      (await usuarioGerenciaEmpresaHospedagem(adminDb, session.userId, String(reserva.empresa_id)))

    if (!podeGerir) {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    }

    const { error: upErr } = await adminDb
      .from('reservas_hospedagem')
      .update({ pos_checkout_status: status })
      .eq('id', reservaId)

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 400 })
    }

    // Se ocupado: bloqueia o dia do check-out (e o anfitrião pode estender no calendário)
    if (status === 'ocupado' && reserva.acomodacao_id) {
      await adminDb.from('hospedagem_bloqueios_calendario').insert({
        acomodacao_id: reserva.acomodacao_id,
        empresa_id: reserva.empresa_id,
        data_inicio: checkout,
        data_fim: checkout,
        motivo: 'Pós check-out: anfitrião marcou como ocupado',
      })
    }

    if (reserva.canal_financeiro_id) {
      const { data: canal } = await adminDb
        .from('canal_financeiro')
        .select('metadata')
        .eq('id', reserva.canal_financeiro_id)
        .maybeSingle()

      const meta =
        canal?.metadata && typeof canal.metadata === 'object' && !Array.isArray(canal.metadata)
          ? { ...(canal.metadata as Record<string, unknown>) }
          : {}
      meta.pos_checkout_status = status

      await adminDb
        .from('canal_financeiro')
        .update({ metadata: meta })
        .eq('id', reserva.canal_financeiro_id)
    }

    return NextResponse.json({ ok: true, status })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
