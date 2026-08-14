import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { encerrarConversaPorId } from '@/lib/mobilidadeChatCorrida'

type Ctx = { params: Promise<{ conversaId: string }> }

/** Encerra o chat temporário (item esquecido / corrida) — mensagens ficam arquivadas. */
export async function POST(_req: Request, ctx: Ctx) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  const { conversaId } = await ctx.params
  const id = String(conversaId ?? '').trim()
  if (!id) return NextResponse.json({ error: 'conversaId obrigatório.' }, { status: 400 })

  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  const { data: conv } = await admin
    .from('mobilidade_conversas')
    .select('id, turista_usuario_id, profissional_usuario_id, status')
    .eq('id', id)
    .maybeSingle()

  if (!conv) {
    return NextResponse.json({ error: 'Conversa não encontrada.' }, { status: 404 })
  }

  const ok =
    String(conv.turista_usuario_id) === auth.userId ||
    String(conv.profissional_usuario_id) === auth.userId ||
    auth.role === 'admin'
  if (!ok) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }

  if (String(conv.status) !== 'aberta') {
    return NextResponse.json({ ok: true, status: 'encerrada' })
  }

  const res = await encerrarConversaPorId(admin, id)
  if ('error' in res) {
    return NextResponse.json({ error: res.error }, { status: 500 })
  }

  return NextResponse.json({ ok: true, status: 'encerrada' })
}
