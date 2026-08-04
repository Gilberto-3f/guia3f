import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { responderOfertaMobilidade } from '@/lib/mobilidadeMatching'

export async function POST(req: Request) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  if (auth.role !== 'profissional') {
    return NextResponse.json({ error: 'Apenas profissionais.' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const solicitacaoId = String(body.solicitacao_id ?? '').trim()
  const aceitar = body.aceitar === true
  if (!solicitacaoId) {
    return NextResponse.json({ error: 'solicitacao_id obrigatório.' }, { status: 400 })
  }

  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  const res = await responderOfertaMobilidade(admin, {
    solicitacaoId,
    profissionalUsuarioId: auth.userId,
    aceitar,
    justificativa: body.justificativa != null ? String(body.justificativa) : null,
    justificativaDetalhe:
      body.justificativa_detalhe != null
        ? String(body.justificativa_detalhe)
        : body.detalhe != null
          ? String(body.detalhe)
          : null,
  })

  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    status: res.status,
    conversa_id: res.conversaId ?? null,
  })
}
