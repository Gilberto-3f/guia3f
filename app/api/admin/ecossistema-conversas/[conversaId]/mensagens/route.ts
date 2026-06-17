import { NextResponse } from 'next/server'
import { assertAdminSession } from '@/lib/adminApiAuth'
import {
  atribuirAdmResponsavel,
  enviarMensagemEcossistema,
  listarMensagensEcossistema,
  marcarConversaEcossistemaLida,
} from '@/lib/ecossistemaConversas'

type RouteCtx = { params: Promise<{ conversaId: string }> }

export async function GET(_req: Request, ctx: RouteCtx) {
  const auth = await assertAdminSession()
  if (!auth.ok) return auth.error

  const { conversaId } = await ctx.params
  const mensagens = await listarMensagensEcossistema(auth.supabase, conversaId)
  const ultimaIso = mensagens.length > 0 ? mensagens[mensagens.length - 1]?.created_at ?? null : null
  await marcarConversaEcossistemaLida(auth.supabase, auth.userId, conversaId, ultimaIso)
  return NextResponse.json({ ok: true, mensagens })
}

export async function POST(req: Request, ctx: RouteCtx) {
  const auth = await assertAdminSession()
  if (!auth.ok) return auth.error

  const { conversaId } = await ctx.params
  const body = (await req.json()) as Record<string, unknown>
  const texto = body.texto != null ? String(body.texto) : null

  await atribuirAdmResponsavel(auth.supabase, conversaId, auth.userId)

  const res = await enviarMensagemEcossistema(auth.supabase, {
    conversaId,
    remetenteId: auth.userId,
    texto,
  })

  if (!res.ok) {
    return NextResponse.json({ error: res.error ?? 'Falha ao enviar.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, mensagem: res.mensagem })
}
