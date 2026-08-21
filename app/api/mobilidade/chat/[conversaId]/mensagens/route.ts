import { NextResponse } from 'next/server'
import { assertUserSession, assertUserSessionLight } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

type Ctx = { params: Promise<{ conversaId: string }> }

async function assertParticipante(admin: ReturnType<typeof createSupabaseAdmin>, conversaId: string, userId: string) {
  const { data: conv } = await admin
    .from('mobilidade_conversas')
    .select('id, turista_usuario_id, profissional_usuario_id, status, solicitacao_id')
    .eq('id', conversaId)
    .maybeSingle()
  if (!conv) return null
  const ok =
    String(conv.turista_usuario_id) === userId ||
    String(conv.profissional_usuario_id) === userId
  return ok ? conv : null
}

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await assertUserSessionLight()
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

  const conv = await assertParticipante(admin, id, auth.userId)
  if (!conv) {
    return NextResponse.json({ error: 'Conversa não encontrada.' }, { status: 404 })
  }

  const { data: msgs, error } = await admin
    .from('mobilidade_mensagens')
    .select('id, remetente_id, texto, created_at')
    .eq('conversa_id', id)
    .order('created_at', { ascending: true })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    status: conv?.status ?? 'aberta',
    solicitacao_id: conv?.solicitacao_id ?? null,
    mensagens: (msgs ?? []).map((m) => ({
      id: String(m.id),
      remetente_id: String(m.remetente_id),
      texto: String(m.texto ?? ''),
      created_at: String(m.created_at),
    })),
  })
}

export async function POST(req: Request, ctx: Ctx) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  const { conversaId } = await ctx.params
  const id = String(conversaId ?? '').trim()
  if (!id) return NextResponse.json({ error: 'conversaId obrigatório.' }, { status: 400 })

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const texto = String(body.texto ?? '').trim()
  if (!texto || texto.length > 2000) {
    return NextResponse.json({ error: 'Texto inválido.' }, { status: 400 })
  }

  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  const conv = await assertParticipante(admin, id, auth.userId)
  if (!conv) {
    return NextResponse.json({ error: 'Conversa não encontrada.' }, { status: 404 })
  }
  if (String(conv.status) !== 'aberta') {
    return NextResponse.json({ error: 'Chat encerrado.' }, { status: 400 })
  }

  const { data: msg, error } = await admin
    .from('mobilidade_mensagens')
    .insert({
      conversa_id: id,
      remetente_id: auth.userId,
      texto,
    })
    .select('id, remetente_id, texto, created_at')
    .maybeSingle()

  if (error || !msg) {
    return NextResponse.json({ error: error?.message ?? 'Falha ao enviar.' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    mensagem: {
      id: String(msg.id),
      remetente_id: String(msg.remetente_id),
      texto: String(msg.texto ?? ''),
      created_at: String(msg.created_at),
    },
  })
}
