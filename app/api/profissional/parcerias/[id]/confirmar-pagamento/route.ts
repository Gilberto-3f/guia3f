import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { inserirNotificacaoCanalFinanceiroProfissional } from '@/lib/canalFinanceiroProfissional'
import { joinSupabaseRow } from '@/lib/supabaseJoinRow'

type Acao = 'pagamento' | 'recebimento'

/**
 * POST — confirma pagamento (indicado) ou recebimento (indicador).
 * Sem timeout: permanece pendente até as duas partes confirmarem.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  const { id: parceriaId } = await ctx.params
  if (!parceriaId) {
    return NextResponse.json({ error: 'id obrigatório.' }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const acao = String(body.acao ?? '').trim() as Acao
  if (acao !== 'pagamento' && acao !== 'recebimento') {
    return NextResponse.json(
      { error: 'acao deve ser pagamento ou recebimento.' },
      { status: 400 },
    )
  }

  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  const { data: eu } = await admin
    .from('profissionais')
    .select('id, nome_completo, nome_usuario, whatsapp')
    .eq('usuario_id', auth.userId)
    .maybeSingle()

  if (!eu?.id) {
    return NextResponse.json({ error: 'Profissional não encontrado.' }, { status: 403 })
  }

  const { data: row } = await admin
    .from('parcerias_profissionais')
    .select(
      `
      id, status, profissional_a_id, profissional_b_id,
      pagamento_confirmado_em, recebimento_confirmado_em, liquidado_em,
      recomendacao:recomendacao_id (profissional_indicador_id)
    `,
    )
    .eq('id', parceriaId)
    .maybeSingle()

  if (!row?.id) {
    return NextResponse.json({ error: 'Parceria não encontrada.' }, { status: 404 })
  }

  const profId = String(eu.id)
  const isA = String(row.profissional_a_id) === profId
  const isB = String(row.profissional_b_id) === profId
  if (!isA && !isB) {
    return NextResponse.json({ error: 'Você não participa desta parceria.' }, { status: 403 })
  }

  const rec = joinSupabaseRow(row.recomendacao)
  const indicadorId =
    rec?.profissional_indicador_id != null ? String(rec.profissional_indicador_id) : null
  const souIndicador = indicadorId != null && indicadorId === profId

  // Indicador confirma recebimento; indicado/parceiro confirma pagamento.
  // Recebimento só após pagamento confirmado.
  if (acao === 'recebimento' && !souIndicador) {
    return NextResponse.json(
      { error: 'Apenas quem recebe a bonificação confirma o recebimento.' },
      { status: 403 },
    )
  }
  if (acao === 'pagamento' && souIndicador) {
    return NextResponse.json(
      { error: 'Quem recebe não confirma pagamento — use confirmar recebimento.' },
      { status: 403 },
    )
  }
  if (acao === 'recebimento' && !row.pagamento_confirmado_em) {
    return NextResponse.json(
      { error: 'Aguarde a confirmação de pagamento antes de confirmar o recebimento.' },
      { status: 403 },
    )
  }

  if (acao === 'pagamento' && row.pagamento_confirmado_em) {
    return NextResponse.json({ ok: true, ja_confirmado: true, acao })
  }
  if (acao === 'recebimento' && row.recebimento_confirmado_em) {
    return NextResponse.json({ ok: true, ja_confirmado: true, acao })
  }

  const agora = new Date().toISOString()
  const patch: Record<string, unknown> =
    acao === 'pagamento'
      ? { pagamento_confirmado_em: agora, pagamento_confirmado_por: auth.userId }
      : { recebimento_confirmado_em: agora, recebimento_confirmado_por: auth.userId }

  const pagOk = acao === 'pagamento' || Boolean(row.pagamento_confirmado_em)
  const recOk = acao === 'recebimento' || Boolean(row.recebimento_confirmado_em)
  if (pagOk && recOk) {
    patch.liquidado_em = agora
    if (String(row.status) === 'em_andamento') {
      patch.status = 'concluida'
    }
  }

  const { error: upErr } = await admin
    .from('parcerias_profissionais')
    .update(patch)
    .eq('id', parceriaId)

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 })
  }

  const outroProfId = isA ? String(row.profissional_b_id) : String(row.profissional_a_id)
  const { data: outro } = await admin
    .from('profissionais')
    .select('usuario_id, nome_completo, nome_usuario, whatsapp')
    .eq('id', outroProfId)
    .maybeSingle()

  if (outro?.usuario_id) {
    const meuNome = String(eu.nome_completo ?? 'Parceiro')
    const titulo =
      acao === 'pagamento'
        ? `${meuNome} confirmou o pagamento`
        : `${meuNome} confirmou o recebimento`
    const mensagem =
      pagOk && recOk
        ? 'Pagamento e recebimento confirmados. Parceria liquidada (sem prazo de expiração — ficou pendente até as duas partes).'
        : 'Aguardando a outra parte confirmar. Sem timeout — permanece pendente até as duas confirmações.'

    await inserirNotificacaoCanalFinanceiroProfissional(admin, {
      profissionalUsuarioId: String(outro.usuario_id),
      tipo: 'extrato_parceria',
      titulo,
      mensagem,
      comprovanteDetalhes: {
        kind: 'confirmar_pagamento_bilateral',
        parceria_id: parceriaId,
        acao,
        liquidado: Boolean(pagOk && recOk),
        parceiro: {
          nome: meuNome,
          username: eu.nome_usuario != null ? String(eu.nome_usuario) : null,
          whatsapp: eu.whatsapp != null ? String(eu.whatsapp) : null,
        },
      },
    })

    // Espelho no próprio canal
    await inserirNotificacaoCanalFinanceiroProfissional(admin, {
      profissionalUsuarioId: auth.userId,
      tipo: 'extrato_parceria',
      titulo: acao === 'pagamento' ? 'Você confirmou o pagamento' : 'Você confirmou o recebimento',
      mensagem,
      comprovanteDetalhes: {
        kind: 'confirmar_pagamento_bilateral',
        parceria_id: parceriaId,
        acao,
        liquidado: Boolean(pagOk && recOk),
        parceiro: {
          nome: String(outro.nome_completo ?? 'Parceiro'),
          username: outro.nome_usuario != null ? String(outro.nome_usuario) : null,
          whatsapp: outro.whatsapp != null ? String(outro.whatsapp) : null,
        },
      },
    })
  }

  return NextResponse.json({
    ok: true,
    acao,
    liquidado: Boolean(pagOk && recOk),
    pagamento_confirmado: pagOk,
    recebimento_confirmado: recOk,
  })
}
