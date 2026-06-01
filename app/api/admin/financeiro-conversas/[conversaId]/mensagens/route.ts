import { NextResponse } from 'next/server'
import { assertAdminSession } from '@/lib/adminApiAuth'
import { enviarMensagemConversaFinanceiro, listarMensagensConversa } from '@/lib/financeiroConversas'

type RouteCtx = { params: Promise<{ conversaId: string }> }

export async function GET(_req: Request, ctx: RouteCtx) {
  const auth = await assertAdminSession()
  if (!auth.ok) return auth.error

  const { conversaId } = await ctx.params
  const mensagens = await listarMensagensConversa(auth.supabase, conversaId)
  return NextResponse.json({ ok: true, mensagens })
}

export async function POST(req: Request, ctx: RouteCtx) {
  const auth = await assertAdminSession()
  if (!auth.ok) return auth.error

  const { conversaId } = await ctx.params
  const body = (await req.json()) as Record<string, unknown>
  const texto = String(body.texto ?? '')

  const res = await enviarMensagemConversaFinanceiro(auth.supabase, {
    conversaId,
    remetenteId: auth.userId,
    texto,
  })

  if (!res.ok) {
    return NextResponse.json({ error: res.error ?? 'Erro ao enviar.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, mensagem: res.mensagem })
}
