import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { buscarProfissionalPlacaVermelha } from '@/lib/manifestoDiario'
import {
  proporFinalizacaoSemCheckin,
  validarMotivoProfissional,
} from '@/lib/manifestoFinalizacaoSemCheckin'

/** Profissional informa o motivo e aguarda o turista confirmar a finalização sem check-in. */
export async function POST(req: Request) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  const prof = await buscarProfissionalPlacaVermelha(auth.supabase, auth.userId)
  if (!prof?.placa_vermelha) {
    return NextResponse.json({ error: 'Acesso restrito a profissionais com placa vermelha.' }, { status: 403 })
  }

  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  const body = (await req.json()) as Record<string, unknown>
  const manifestoId = String(body.manifesto_id ?? '').trim()
  if (!manifestoId) {
    return NextResponse.json({ error: 'manifesto_id obrigatório.' }, { status: 400 })
  }

  const motivo = validarMotivoProfissional({
    motivo: body.motivo,
    detalhe: body.detalhe,
  })
  if (!motivo.ok) return NextResponse.json({ error: motivo.error }, { status: 400 })

  const res = await proporFinalizacaoSemCheckin(admin, {
    manifestoId,
    profissionalId: prof.id,
    motivoId: motivo.id,
    motivoTexto: motivo.texto,
  })
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
