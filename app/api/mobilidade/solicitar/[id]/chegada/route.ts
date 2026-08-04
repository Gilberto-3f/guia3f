import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import {
  registrarChegadaNoLocal,
  responderEmbarqueNoLocal,
} from '@/lib/mobilidadeChegada'

type Ctx = { params: Promise<{ id: string }> }

/** Chegada GPS + confirmação de embarque (SIM/NÃO). */
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

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const acao = String(body.acao ?? '').trim()
  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  if (acao === 'detectar') {
    const lat = Number(body.lat)
    const lng = Number(body.lng)
    const res = await registrarChegadaNoLocal(admin, {
      solicitacaoId,
      profissionalUsuarioId: auth.userId,
      lat,
      lng,
    })
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
    return NextResponse.json({
      ok: true,
      status: res.status,
      distancia_m: res.distancia_m,
    })
  }

  if (acao === 'confirmar') {
    const res = await responderEmbarqueNoLocal(admin, {
      solicitacaoId,
      profissionalUsuarioId: auth.userId,
      turistaRecebido: true,
    })
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
    return NextResponse.json({ ok: true, status: res.status })
  }

  if (acao === 'recusar') {
    const res = await responderEmbarqueNoLocal(admin, {
      solicitacaoId,
      profissionalUsuarioId: auth.userId,
      turistaRecebido: false,
    })
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
    return NextResponse.json({ ok: true, status: res.status })
  }

  return NextResponse.json(
    { error: 'acao deve ser detectar, confirmar ou recusar.' },
    { status: 400 },
  )
}
