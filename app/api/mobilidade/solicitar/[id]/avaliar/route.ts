import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import {
  avaliarCorridaMobilidade,
  statusAvaliacaoCorrida,
} from '@/lib/mobilidadeAvaliacao'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctx: Ctx) {
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

  const st = await statusAvaliacaoCorrida(
    admin,
    solicitacaoId,
    auth.userId,
    auth.role ?? '',
  )
  return NextResponse.json({ ok: true, ...st })
}

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

  const role =
    auth.role === 'profissional'
      ? 'profissional'
      : auth.role === 'admin'
        ? 'admin'
        : 'turista'

  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  const res = await avaliarCorridaMobilidade(admin, {
    solicitacaoId,
    avaliadorUsuarioId: auth.userId,
    role,
    nota: Number(body.nota),
    feedback: body.feedback != null ? String(body.feedback) : null,
  })

  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 400 })
  }

  return NextResponse.json({ ok: true, avaliacao_id: res.avaliacaoId })
}
