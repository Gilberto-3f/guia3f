import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { buscarProfissionaisOnlineMapa } from '@/lib/mobilidadeProfissionaisOnline'

/** Profissionais online no mapa (autenticado). */
export async function GET() {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  const { lista, error } = await buscarProfissionaisOnlineMapa()
  if (error) return NextResponse.json({ error }, { status: 400 })
  return NextResponse.json({ ok: true, profissionais: lista })
}
