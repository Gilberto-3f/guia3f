import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

function metaObj(raw: unknown): Record<string, unknown> {
  return typeof raw === 'object' && raw != null && !Array.isArray(raw)
    ? { ...(raw as Record<string, unknown>) }
    : {}
}

const JANELA_MS = 24 * 60 * 60 * 1000

/**
 * Corrida concluída recente ainda sem ack de UI (popup verde) / avaliação.
 * Turista e profissional.
 */
export async function GET() {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  const agora = Date.now()
  const papel =
    auth.role === 'profissional'
      ? 'profissional'
      : auth.role === 'turista' || auth.role === 'empresa' || auth.role === 'admin'
        ? 'turista'
        : null

  if (!papel) {
    return NextResponse.json({ ok: true, conclusao: null })
  }

  let query = admin
    .from('solicitacao_mobilidade')
    .select(
      'id, status, valor_estimado, pagamento, metadata, turista_id, profissional_id, updated_at',
    )
    .eq('status', 'concluida')
    .order('updated_at', { ascending: false })
    .limit(5)

  if (papel === 'turista') {
    query = query.eq('turista_id', auth.userId)
  } else {
    const { data: prof } = await admin
      .from('profissionais')
      .select('id')
      .eq('usuario_id', auth.userId)
      .maybeSingle()
    if (!prof?.id) {
      return NextResponse.json({ ok: true, conclusao: null })
    }
    query = query.eq('profissional_id', prof.id)
  }

  const { data: rows } = await query
  const lista = Array.isArray(rows) ? rows : []

  for (const row of lista) {
    const meta = metaObj(row.metadata)
    const concluidoEm =
      meta.concluido_em != null
        ? new Date(String(meta.concluido_em)).getTime()
        : row.updated_at
          ? new Date(String(row.updated_at)).getTime()
          : 0
    if (!Number.isFinite(concluidoEm) || agora - concluidoEm > JANELA_MS) continue

    const ackKey = papel === 'profissional' ? 'conclusao_ack_pro' : 'conclusao_ack_turista'
    const avalKey =
      papel === 'profissional' ? 'avaliacao_profissional_id' : 'avaliacao_turista_id'
    const jaAvaliou = Boolean(meta[avalKey])
    const jaAck = Boolean(meta[ackKey])

    // Sem ack → mostrar resumo; com ack e sem avaliação → mostrar avaliar
    if (jaAck && jaAvaliou) continue
    if (jaAck && !jaAvaliou) {
      // ainda pode avaliar — devolve fase avaliar
    } else if (jaAck) {
      continue
    }

    const valorCorrida =
      meta.financeiro_valor_corrida != null
        ? Number(meta.financeiro_valor_corrida)
        : row.valor_estimado != null
          ? Number(row.valor_estimado)
          : null

    return NextResponse.json({
      ok: true,
      conclusao: {
        solicitacao_id: String(row.id),
        papel,
        fase: jaAck ? 'avaliar' : 'resumo',
        valor_corrida: Number.isFinite(valorCorrida as number) ? valorCorrida : null,
        pagamento: row.pagamento != null ? String(row.pagamento) : null,
        valor_regular:
          meta.financeiro_valor_regular != null
            ? Number(meta.financeiro_valor_regular)
            : null,
        bonus_voluntario:
          meta.financeiro_bonus_voluntario != null
            ? Number(meta.financeiro_bonus_voluntario)
            : null,
        ja_avaliou: jaAvaliou,
      },
    })
  }

  return NextResponse.json({ ok: true, conclusao: null })
}
