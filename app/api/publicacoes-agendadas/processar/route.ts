import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { processarPublicacoesAgendadasVencidas } from '@/lib/publicarPublicacaoAgendada'

function parseCronAuth(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization')
  return header === `Bearer ${secret}`
}

/** Publica publicações agendadas cujo horário já passou (service role ou cron). */
export async function POST(request: Request) {
  return executarProcessamento(request)
}

/** Vercel Cron / GET com Authorization Bearer CRON_SECRET. */
export async function GET(request: Request) {
  if (!parseCronAuth(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  return executarProcessamento(request)
}

async function executarProcessamento(_request: Request) {
  try {
    const admin = createSupabaseAdmin()

    const { data: rpcData, error: rpcError } = await admin.rpc('processar_publicacoes_agendadas_vencidas')
    if (!rpcError && rpcData && typeof rpcData === 'object' && !Array.isArray(rpcData)) {
      const row = rpcData as { processadas?: number; erros?: number }
      return NextResponse.json({
        ok: true,
        processadas: Number(row.processadas) || 0,
        erros: Number(row.erros) || 0,
        via: 'rpc',
      })
    }

    const { processadas, erros } = await processarPublicacoesAgendadasVencidas(admin)
    return NextResponse.json({ ok: true, processadas, erros, via: 'ts' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    if (msg.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return NextResponse.json({ ok: false, error: 'server_config' }, { status: 503 })
    }
    console.error('[api/publicacoes-agendadas/processar]', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
