import { NextResponse } from 'next/server'
import { assertAdminSession } from '@/lib/adminApiAuth'
import {
  encerrarConversaEcossistema,
  listarMensagensEcossistema,
} from '@/lib/ecossistemaConversas'
import { notificarChatEcossistemaArquivado } from '@/lib/notificarChatEcossistemaArquivado'

type RouteCtx = { params: Promise<{ conversaId: string }> }

export async function GET(_req: Request, ctx: RouteCtx) {
  const auth = await assertAdminSession()
  if (!auth.ok) return auth.error

  const { conversaId } = await ctx.params
  const { data: conversa, error } = await auth.supabase
    .from('ecossistema_conversas')
    .select('*')
    .eq('id', conversaId)
    .maybeSingle()

  if (error || !conversa) {
    return NextResponse.json({ ok: false, error: 'Conversa não encontrada.' }, { status: 404 })
  }

  const mensagens = await listarMensagensEcossistema(auth.supabase, conversaId)
  return NextResponse.json({ ok: true, conversa, mensagens })
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  const auth = await assertAdminSession()
  if (!auth.ok) return auth.error

  const { conversaId } = await ctx.params
  const body = (await req.json()) as Record<string, unknown>
  const acao = body.acao != null ? String(body.acao) : ''

  if (acao !== 'encerrar') {
    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  }

  const resumo = body.resumo != null ? String(body.resumo) : null
  const res = await encerrarConversaEcossistema(auth.supabase, conversaId, auth.userId)

  if (!res.ok || !res.conversa) {
    return NextResponse.json({ error: res.error ?? 'Erro ao encerrar.' }, { status: 500 })
  }

  const notif = await notificarChatEcossistemaArquivado(auth.supabase, res.conversa, { resumo })
  if (!notif.ok) {
    console.error('[ecossistema] historico_decisoes:', notif.error)
  }

  return NextResponse.json({ ok: true, conversa: res.conversa })
}
