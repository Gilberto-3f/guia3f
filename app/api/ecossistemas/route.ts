import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { listarEcossistemasDb } from '@/lib/ecossistemas'

/** Catálogo público para cadastro (empresa/profissional) e, depois, o chevron da home. */
export async function GET() {
  try {
    const db = createSupabaseAdmin()
    const lista = await listarEcossistemasDb(db)
    return NextResponse.json({ ok: true, ecossistemas: lista })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro'
    const lower = msg.toLowerCase()
    if (
      lower.includes('does not exist') ||
      lower.includes('schema cache') ||
      lower.includes('em falta') ||
      lower.includes('service_role')
    ) {
      return NextResponse.json({ ok: true, ecossistemas: [] })
    }
    return NextResponse.json({ ok: false, error: msg, ecossistemas: [] }, { status: 500 })
  }
}
