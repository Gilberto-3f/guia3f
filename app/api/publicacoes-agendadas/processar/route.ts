import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { processarPublicacoesAgendadasVencidas } from '@/lib/publicarPublicacaoAgendada'

/** Publica publicações agendadas cujo horário já passou (service role). */
export async function POST() {
  try {
    const admin = createSupabaseAdmin()
    const { processadas, erros } = await processarPublicacoesAgendadasVencidas(admin)
    return NextResponse.json({ ok: true, processadas, erros })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    if (msg.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      return NextResponse.json({ ok: false, error: 'server_config' }, { status: 503 })
    }
    console.error('[api/publicacoes-agendadas/processar]', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
