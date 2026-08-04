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
    dadosPax:
      body.nome_completo != null && body.data_nascimento != null && body.documento != null
        ? {
            nome_completo: String(body.nome_completo),
            data_nascimento: String(body.data_nascimento).slice(0, 10),
            documento: String(body.documento),
          }
        : body.dados_pax && typeof body.dados_pax === 'object'
          ? {
              nome_completo: String((body.dados_pax as Record<string, unknown>).nome_completo ?? ''),
              data_nascimento: String(
                (body.dados_pax as Record<string, unknown>).data_nascimento ?? '',
              ).slice(0, 10),
              documento: String((body.dados_pax as Record<string, unknown>).documento ?? ''),
            }
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
