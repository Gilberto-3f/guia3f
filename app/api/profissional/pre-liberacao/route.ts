import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { atualizarCanalFinanceiroPreLiberacaoRespondido, expiraEm24h } from '@/lib/turistaPreLiberacao'
import { profissionalRecursosLiberados } from '@/lib/verificacao-documentos'

export async function POST(req: Request) {
  try {
    const session = await assertUserSession()
    if (!session.ok) return session.error

    if (session.role !== 'profissional') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const body = (await req.json()) as Record<string, unknown>
    const solicitacaoId = String(body.solicitacao_id ?? '').trim()
    const acao = String(body.acao ?? '').trim()

    if (!solicitacaoId || !['aprovar', 'recusar'].includes(acao)) {
      return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 })
    }

    let adminDb
    try {
      adminDb = createSupabaseAdmin()
    } catch {
      return NextResponse.json({ error: 'server_config' }, { status: 503 })
    }

    const { data: prof } = await adminDb
      .from('profissionais')
      .select('id, status, docs_verificado, proxima_revisao_docs_em')
      .eq('usuario_id', session.userId)
      .maybeSingle()

    const { data: uProf } = await adminDb.from('usuarios').select('status').eq('id', session.userId).maybeSingle()

    if (
      !profissionalRecursosLiberados(uProf?.status != null ? String(uProf.status) : null, {
        status: prof?.status != null ? String(prof.status) : null,
        docs_verificado: Boolean(prof?.docs_verificado),
        proxima_revisao_docs_em:
          prof?.proxima_revisao_docs_em != null ? String(prof.proxima_revisao_docs_em) : null,
      })
    ) {
      return NextResponse.json({ error: 'Profissional não verificado.' }, { status: 403 })
    }

    const { data: sol, error: loadErr } = await adminDb
      .from('turista_pre_liberacoes')
      .select('*')
      .eq('id', solicitacaoId)
      .eq('profissional_usuario_id', session.userId)
      .maybeSingle()

    if (loadErr || !sol) {
      return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 })
    }

    if (String(sol.status) !== 'pendente') {
      return NextResponse.json({ error: 'Solicitação já respondida.' }, { status: 400 })
    }

    const now = new Date().toISOString()

    if (acao === 'recusar') {
      await adminDb
        .from('turista_pre_liberacoes')
        .update({ status: 'recusada', respondido_em: now })
        .eq('id', solicitacaoId)

      await atualizarCanalFinanceiroPreLiberacaoRespondido(adminDb, sol, 'recusar')

      return NextResponse.json({ ok: true, status: 'recusada' })
    }

    const expira = expiraEm24h()

    await adminDb
      .from('turista_pre_liberacoes')
      .update({ status: 'aprovada', respondido_em: now, expira_em: expira })
      .eq('id', solicitacaoId)

    await adminDb
      .from('usuarios')
      .update({
        turista_pre_liberado_ate: expira,
        turista_pre_liberado_por: session.userId,
        status: 'ativo',
      })
      .eq('id', sol.turista_usuario_id)

    await atualizarCanalFinanceiroPreLiberacaoRespondido(adminDb, sol, 'aprovar', expira)

    return NextResponse.json({ ok: true, status: 'aprovada', expira_em: expira })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
