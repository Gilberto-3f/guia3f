import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { listarEcossistemasDbCached } from '@/lib/ecossistemas'

export const dynamic = 'force-dynamic'

function jsonCatalogo(lista: unknown[], status = 200) {
  const vazio = !Array.isArray(lista) || lista.length === 0
  return NextResponse.json(
    { ok: !vazio, ecossistemas: Array.isArray(lista) ? lista : [] },
    {
      status,
      headers: {
        'Cache-Control': vazio ? 'no-store' : 'public, s-maxage=60, stale-while-revalidate=120',
      },
    },
  )
}

/** Catálogo público para cadastro (empresa/profissional) e o chevron da home. */
export async function GET() {
  try {
    const db = createSupabaseAdmin()
    const lista = await listarEcossistemasDbCached(db)
    if (lista.length === 0) {
      return jsonCatalogo([], 503)
    }
    return jsonCatalogo(lista)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro'
    const lower = msg.toLowerCase()
    if (
      lower.includes('does not exist') ||
      lower.includes('schema cache') ||
      lower.includes('em falta') ||
      lower.includes('service_role') ||
      lower.includes('timeout') ||
      lower.includes('abort')
    ) {
      return jsonCatalogo([], 503)
    }
    return NextResponse.json(
      { ok: false, error: msg, ecossistemas: [] },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
