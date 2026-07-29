import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { concluirCorridaMobilidade } from '@/lib/mobilidadeCorrida'

type Ctx = { params: Promise<{ id: string }> }

/** Profissional conclui a corrida aceita (libera status + manifesto + chat). */
export async function POST(req: Request, ctx: Ctx) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  if (auth.role !== 'profissional') {
    return NextResponse.json({ error: 'Apenas profissionais.' }, { status: 403 })
  }

  const { id } = await ctx.params
  const solicitacaoId = String(id ?? '').trim()
  if (!solicitacaoId) {
    return NextResponse.json({ error: 'id obrigatório.' }, { status: 400 })
  }

  let body: Record<string, unknown> = {}
  try {
    const raw = await req.text()
    if (raw.trim()) body = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  const exigir =
    body.forcar !== true && body.ignorar_manifesto !== true

  const res = await concluirCorridaMobilidade(admin, {
    solicitacaoId,
    profissionalUsuarioId: auth.userId,
    exigirManifestoOk: exigir,
  })

  if (!res.ok) {
    return NextResponse.json(
      {
        error: res.error,
        manifesto_pendente_checkin: res.manifestoPendenteCheckin === true,
      },
      { status: 400 },
    )
  }

  return NextResponse.json({
    ok: true,
    status: res.status,
    manifesto_concluido: res.manifestoConcluido,
    manifesto_pendente_checkin: res.manifestoPendenteCheckin === true,
  })
}
