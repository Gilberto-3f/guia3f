import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { abrirOuObterConversaCorrida } from '@/lib/mobilidadeChatCorrida'

/** Abre (ou retorna) o chat da corrida aceita. */
export async function POST(req: Request) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const solicitacaoId = String(body.solicitacao_id ?? '').trim()
  if (!solicitacaoId) {
    return NextResponse.json({ error: 'solicitacao_id obrigatório.' }, { status: 400 })
  }

  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  const { data: row } = await admin
    .from('solicitacao_mobilidade')
    .select('id, turista_id, profissional_id, status')
    .eq('id', solicitacaoId)
    .maybeSingle()

  if (
    !row ||
    !row.profissional_id ||
    !['aceita', 'a_caminho', 'no_local', 'em_viagem'].includes(String(row.status))
  ) {
    return NextResponse.json({ error: 'Corrida ainda não aceita.' }, { status: 400 })
  }

  const { data: prof } = await admin
    .from('profissionais')
    .select('id, usuario_id')
    .eq('id', row.profissional_id)
    .maybeSingle()

  if (!prof?.usuario_id) {
    return NextResponse.json({ error: 'Profissional não encontrado.' }, { status: 404 })
  }

  const isTurista = String(row.turista_id) === auth.userId
  const isProf = String(prof.usuario_id) === auth.userId
  if (!isTurista && !isProf && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }

  const chat = await abrirOuObterConversaCorrida(admin, {
    solicitacaoId,
    turistaUsuarioId: String(row.turista_id),
    profissionalUsuarioId: String(prof.usuario_id),
  })

  if ('error' in chat) {
    return NextResponse.json({ error: chat.error }, { status: 500 })
  }

  return NextResponse.json({ ok: true, conversa_id: chat.conversaId })
}
