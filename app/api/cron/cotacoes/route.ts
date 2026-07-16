import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { sincronizarCotacoes } from '@/lib/cotacoesSync'

function parseCronAuth(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization')
  return header === `Bearer ${secret}`
}

/**
 * Job diário de cotações (AwesomeAPI ou fallback manual em config_apis).
 * Vercel Cron: GET com Authorization Bearer CRON_SECRET.
 */
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

async function executar() {
  try {
    const admin = createSupabaseAdmin()
    const result = await sincronizarCotacoes(admin)
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.erro ?? 'sync_failed', modo: result.modo },
        { status: 502 },
      )
    }
    return NextResponse.json({
      ok: true,
      modo: result.modo,
      atualizadas: result.atualizadas,
      map: result.map,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    if (msg.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return NextResponse.json({ ok: false, error: 'server_config' }, { status: 503 })
    }
    console.error('[api/cron/cotacoes]', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
