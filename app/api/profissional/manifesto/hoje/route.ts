import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { buscarProfissionalPlacaVermelha } from '@/lib/manifestoDiario'
import { sincronizarManifestoHoje } from '@/lib/manifestoLista'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

/** Garante o manifesto de hoje com todos os passageiros guia/van do dia. */
export async function POST() {
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

  const res = await sincronizarManifestoHoje(admin, prof.id)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
  return NextResponse.json({ ok: true, manifesto_id: res.manifestoId })
}
