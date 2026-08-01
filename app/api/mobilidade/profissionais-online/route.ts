import { NextResponse } from 'next/server'
import { assertUserSessionLight } from '@/lib/apiUserSession'
import { buscarProfissionaisOnlineMapa } from '@/lib/mobilidadeProfissionaisOnline'

/** Profissionais online no mapa (autenticado, auth leve). */
export async function GET() {
  const auth = await assertUserSessionLight()
  if (!auth.ok) return auth.error

  const { lista, error } = await buscarProfissionaisOnlineMapa()
  if (error) {
    const transient = /57014|timeout|canceling|503|overloaded/i.test(error)
    return NextResponse.json({ error, profissionais: [] }, { status: transient ? 503 : 400 })
  }
  return NextResponse.json(
    { ok: true, profissionais: lista },
    { headers: { 'Cache-Control': 'private, max-age=20, stale-while-revalidate=40' } },
  )
}
