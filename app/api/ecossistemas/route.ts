import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { listarEcossistemasDbCached } from '@/lib/ecossistemas'

export const revalidate = 60

/** Catálogo público para cadastro (empresa/profissional) e, depois, o chevron da home. */
export async function GET() {
  try {
    const db = createSupabaseAdmin()
    const lista = await listarEcossistemasDbCached(db)
    return NextResponse.json(
      { ok: true, ecossistemas: lista },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } },
    )
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
      return NextResponse.json({ ok: true, ecossistemas: [] })
    }
    return NextResponse.json({ ok: false, error: msg, ecossistemas: [] }, { status: 500 })
  }
}
