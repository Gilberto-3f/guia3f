import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { buscarEmpresasMapaMobilidade } from '@/lib/mobilidadeMapaEmpresas'

/**
 * Pins do mapa (server-side com service role).
 * Evita competir com Auth/refresh no browser no first load.
 */
export async function GET() {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  const { lista, error } = await buscarEmpresasMapaMobilidade(admin)
  if (error) {
    return NextResponse.json({ error, empresas: [] }, { status: 503 })
  }

  return NextResponse.json(
    { ok: true, empresas: lista },
    {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
      },
    },
  )
}
