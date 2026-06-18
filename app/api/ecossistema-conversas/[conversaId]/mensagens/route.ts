import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import {
  ativarSocorroUrgenteConversa,
  enviarMensagemEcossistema,
  listarMensagensEcossistema,
} from '@/lib/ecossistemaConversas'

type RouteCtx = { params: Promise<{ conversaId: string }> }

export async function GET(_req: Request, ctx: RouteCtx) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  const { conversaId } = await ctx.params
  const { data: conversa, error } = await auth.supabase
    .from('ecossistema_conversas')
    .select('id, membro_usuario_id, status')
    .eq('id', conversaId)
    .maybeSingle()

  if (error || !conversa) {
    return NextResponse.json({ error: 'Conversa não encontrada.' }, { status: 404 })
  }

  if (String(conversa.membro_usuario_id) !== auth.userId) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const mensagens = await listarMensagensEcossistema(auth.supabase, conversaId)
  return NextResponse.json({ ok: true, mensagens })
}

export async function POST(req: Request, ctx: RouteCtx) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  const { conversaId } = await ctx.params
  const body = (await req.json()) as Record<string, unknown>
  const texto = body.texto != null ? String(body.texto) : null
  const anexo_url = body.anexo_url != null ? String(body.anexo_url) : null
  const anexo_tipo = body.anexo_tipo != null ? String(body.anexo_tipo) : null

  const { data: conversa } = await auth.supabase
    .from('ecossistema_conversas')
    .select('id, membro_usuario_id, membro_tipo, status')
    .eq('id', conversaId)
    .maybeSingle()

  if (!conversa || String(conversa.membro_usuario_id) !== auth.userId) {
    return NextResponse.json({ error: 'Conversa não encontrada.' }, { status: 404 })
  }

  const res = await enviarMensagemEcossistema(auth.supabase, {
    conversaId,
    remetenteId: auth.userId,
    texto,
    anexo_url,
    anexo_tipo,
  })

  if (!res.ok) {
    return NextResponse.json({ error: res.error ?? 'Falha ao enviar.' }, { status: 500 })
  }

  const socorro = body.socorro === true || body.urgente === true
  if (socorro && String(conversa.membro_tipo) === 'turista') {
    await ativarSocorroUrgenteConversa(auth.supabase, conversaId, auth.userId)
  }

  return NextResponse.json({ ok: true, mensagem: res.mensagem })
}
