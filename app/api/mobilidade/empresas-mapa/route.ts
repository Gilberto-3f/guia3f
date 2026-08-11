import { NextResponse } from 'next/server'
import { assertUserSessionLight } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { buscarEmpresasMapaMobilidade } from '@/lib/mobilidadeMapaEmpresas'

/**
 * Pins do mapa — mesma elegibilidade do guia (presença pública).
 * Se faltar lat/lng, backfill geocode (até 400/request) + persiste.
 * Cap alto (5000): não esconder empresas visíveis no guia.
 */
export async function GET() {
  const auth = await assertUserSessionLight()
  if (!auth.ok) return auth.error

  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  const { lista, error } = await buscarEmpresasMapaMobilidade(admin)
  if (error) {
    // Não martelar o banco com retry — devolve vazio e deixa o cliente tentar depois
    const transient = /57014|timeout|canceling|503|overloaded/i.test(error)
    return NextResponse.json(
      { error, empresas: [] },
      { status: transient ? 503 : 500 },
    )
  }

  return NextResponse.json(
    { ok: true, empresas: lista },
    {
      headers: {
        // Curto: backfill de coords precisa refletir rápido no cliente
        'Cache-Control': 'private, max-age=15, stale-while-revalidate=60',
      },
    },
  )
}
