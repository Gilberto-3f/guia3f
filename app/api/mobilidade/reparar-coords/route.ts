import { NextResponse } from 'next/server'
import { assertAdminSession } from '@/lib/adminApiAuth'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { repararCoordsEmpresasPresencaPublica } from '@/lib/empresaCoordsReparar'

function parseCronAuth(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

/**
 * POST/GET — geocodifica empresas com presença pública sem coords.
 * Só cron (Bearer CRON_SECRET) ou sessão ADM. Não chamar do mapa público.
 */
async function executarAutorizado(request: Request) {
  const cronOk = parseCronAuth(request)
  if (!cronOk) {
    const admin = await assertAdminSession()
    if (!admin.ok) return admin.error
  }

  let supabase
  try {
    supabase = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  try {
    const result = await repararCoordsEmpresasPresencaPublica(supabase)
    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: Request) {
  return executarAutorizado(request)
}

export async function GET(request: Request) {
  return executarAutorizado(request)
}
