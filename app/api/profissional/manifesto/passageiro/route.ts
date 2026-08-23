import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { buscarProfissionalPlacaVermelha } from '@/lib/manifestoDiario'
import { cancelarPassageiroManifesto, marcarPassageiroRecebido } from '@/lib/manifestoLista'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

/** Check (receptivo) ou X (cancelar) no passageiro da lista. */
export async function POST(req: Request) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  const prof = await buscarProfissionalPlacaVermelha(auth.supabase, auth.userId)
  if (!prof?.placa_vermelha) {
    return NextResponse.json({ error: 'Acesso restrito a profissionais com placa vermelha.' }, { status: 403 })
  }

  const body = (await req.json()) as Record<string, unknown>
  const passageiroId = String(body.passageiro_id ?? '').trim()
  const acao = String(body.acao ?? '').trim()
  if (!passageiroId || (acao !== 'receber' && acao !== 'cancelar')) {
    return NextResponse.json({ error: 'passageiro_id e acao (receber|cancelar) obrigatórios.' }, { status: 400 })
  }

  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  if (acao === 'receber') {
    const res = await marcarPassageiroRecebido(admin, {
      passageiroId,
      profissionalId: prof.id,
    })
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  const justificativa = String(body.justificativa ?? '')
  const res = await cancelarPassageiroManifesto(admin, {
    passageiroId,
    profissionalId: prof.id,
    justificativa,
    profissionalUsuarioId: auth.userId,
  })
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
