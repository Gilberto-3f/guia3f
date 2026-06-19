import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { atualizarLocalizacaoConversaEmergencia } from '@/lib/ecossistemaConversas'

type RouteCtx = { params: Promise<{ conversaId: string }> }

/** Turista perdido: atualiza GPS em tempo real na conversa aberta. */
export async function PATCH(req: Request, ctx: RouteCtx) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  const { conversaId } = await ctx.params
  const body = (await req.json()) as Record<string, unknown>
  const lat = Number(body.lat)
  const lng = Number(body.lng)

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'lat e lng obrigatórios.' }, { status: 400 })
  }

  const res = await atualizarLocalizacaoConversaEmergencia(auth.supabase, conversaId, auth.userId, lat, lng)
  if (!res.ok) {
    return NextResponse.json({ error: res.error ?? 'Erro.' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
