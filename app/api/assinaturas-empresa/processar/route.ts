import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { processarCicloAssinaturasEmpresa } from '@/lib/empresaAssinaturaCiclo'

function parseCronAuth(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization')
  return header === `Bearer ${secret}`
}

/** Marca assinaturas vencidas e envia lembretes D-5/D-1 (cron diário). */
export async function GET(request: Request) {
  if (!parseCronAuth(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  return executarProcessamento()
}

export async function POST(request: Request) {
  if (!parseCronAuth(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  return executarProcessamento()
}

async function executarProcessamento() {
  try {
    const admin = createSupabaseAdmin()
    const resultado = await processarCicloAssinaturasEmpresa(admin)
    return NextResponse.json({ ok: true, ...resultado })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    if (msg.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return NextResponse.json({ ok: false, error: 'server_config' }, { status: 503 })
    }
    console.error('[api/assinaturas-empresa/processar]', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
