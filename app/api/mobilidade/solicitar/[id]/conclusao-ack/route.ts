import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

type Ctx = { params: Promise<{ id: string }> }

function metaObj(raw: unknown): Record<string, unknown> {
  return typeof raw === 'object' && raw != null && !Array.isArray(raw)
    ? { ...(raw as Record<string, unknown>) }
    : {}
}

/** Confirma RECEBIDO / OK do popup de conclusão (libera avaliação). */
export async function POST(_req: Request, ctx: Ctx) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  const { id } = await ctx.params
  const solicitacaoId = String(id ?? '').trim()
  if (!solicitacaoId) {
    return NextResponse.json({ error: 'id obrigatório.' }, { status: 400 })
  }

  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  const { data: row } = await admin
    .from('solicitacao_mobilidade')
    .select('id, status, turista_id, profissional_id, metadata')
    .eq('id', solicitacaoId)
    .maybeSingle()

  if (!row || String(row.status) !== 'concluida') {
    return NextResponse.json({ error: 'Corrida não encontrada.' }, { status: 404 })
  }

  const meta = metaObj(row.metadata)
  const agora = new Date().toISOString()

  if (auth.role === 'profissional') {
    const { data: prof } = await admin
      .from('profissionais')
      .select('id')
      .eq('usuario_id', auth.userId)
      .maybeSingle()
    if (!prof?.id || String(row.profissional_id) !== String(prof.id)) {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    }
    await admin
      .from('solicitacao_mobilidade')
      .update({
        metadata: {
          ...meta,
          conclusao_ack_pro: true,
          conclusao_ack_pro_em: agora,
        },
      })
      .eq('id', solicitacaoId)
    return NextResponse.json({ ok: true, fase: 'avaliar' })
  }

  if (
    auth.role === 'turista' ||
    auth.role === 'empresa' ||
    auth.role === 'admin'
  ) {
    if (String(row.turista_id) !== auth.userId && auth.role !== 'admin') {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    }
    await admin
      .from('solicitacao_mobilidade')
      .update({
        metadata: {
          ...meta,
          conclusao_ack_turista: true,
          conclusao_ack_turista_em: agora,
        },
      })
      .eq('id', solicitacaoId)
    return NextResponse.json({ ok: true, fase: 'avaliar' })
  }

  return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
}
