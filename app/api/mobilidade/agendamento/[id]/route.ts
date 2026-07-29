import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import {
  cancelarAgendamentoMobilidade,
  confirmarAgendamentoMobilidade,
} from '@/lib/mobilidadeAgendamento'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: Request, ctx: Ctx) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  const { id } = await ctx.params
  const solicitacaoId = String(id ?? '').trim()
  if (!solicitacaoId) {
    return NextResponse.json({ error: 'id obrigatório.' }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const acao = String(body.acao ?? '').trim()
  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  if (acao === 'confirmar') {
    if (auth.role !== 'profissional') {
      return NextResponse.json({ error: 'Apenas profissionais.' }, { status: 403 })
    }
    const res = await confirmarAgendamentoMobilidade(admin, {
      solicitacaoId,
      profissionalUsuarioId: auth.userId,
    })
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
    return NextResponse.json({ ok: true, status: 'aceita', conversa_id: res.conversaId ?? null })
  }

  if (acao === 'cancelar') {
    const role =
      auth.role === 'profissional'
        ? 'profissional'
        : auth.role === 'admin'
          ? 'admin'
          : 'turista'
    const res = await cancelarAgendamentoMobilidade(admin, {
      solicitacaoId,
      actorUsuarioId: auth.userId,
      role,
      tentarRematch: role === 'profissional' && body.rematch !== false,
    })
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
    return NextResponse.json({
      ok: true,
      status: 'cancelada',
      rematch_solicitacao_id: res.rematchSolicitacaoId ?? null,
    })
  }

  return NextResponse.json({ error: 'acao deve ser confirmar ou cancelar.' }, { status: 400 })
}
