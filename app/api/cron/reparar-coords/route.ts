import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { repararCoordsEmpresasPresencaPublica } from '@/lib/empresaCoordsReparar'

function parseCronAuth(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

/**
 * Backfill de lat/lng de empresas com presença pública.
 * Vercel Cron: GET com Authorization Bearer CRON_SECRET.
 */
async function executar() {
  try {
    const admin = createSupabaseAdmin()
    const result = await repararCoordsEmpresasPresencaPublica(admin)
    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    if (msg.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return NextResponse.json({ ok: false, error: 'server_config' }, { status: 503 })
    }
    console.error('[api/cron/reparar-coords]', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

export async function GET(request: Request) {
  if (!parseCronAuth(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  return executar()
}

export async function POST(request: Request) {
  if (!parseCronAuth(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  return executar()
}
