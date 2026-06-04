import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import {
  buscarProfissionalVerificadoPorUsername,
  expiraEm24h,
  inserirAvisoPreLiberacaoCanalFinanceiro,
  normalizarUsername,
} from '@/lib/turistaPreLiberacao'
import { turistaRecursosLiberados } from '@/lib/turistaAcesso'
import { turistaDocumentosEnviados } from '@/lib/faseVerificacaoConta'
import { MSG_PRE_LIBERACAO_REQUER_DOCS } from '@/lib/avisoVerificacaoContaTexto'

export async function POST(req: Request) {
  try {
    const session = await assertUserSession()
    if (!session.ok) return session.error

    if (session.role !== 'turista') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const body = (await req.json()) as Record<string, unknown>
    const codigo = normalizarUsername(String(body.codigo ?? ''))
    if (!codigo) {
      return NextResponse.json({ error: 'Informe o username do profissional.' }, { status: 400 })
    }

    let adminDb
    try {
      adminDb = createSupabaseAdmin()
    } catch {
      return NextResponse.json({ error: 'server_config' }, { status: 503 })
    }

    const { data: u } = await adminDb
      .from('usuarios')
      .select('role, status, documentacao_validada_adm, turista_pre_liberado_ate')
      .eq('id', session.userId)
      .maybeSingle()

    if (turistaRecursosLiberados(u)) {
      return NextResponse.json({ error: 'conta_ja_liberada' }, { status: 400 })
    }

    const { data: turDocs } = await adminDb
      .from('turistas')
      .select('documento_frente_url, documento_verso_url')
      .eq('usuario_id', session.userId)
      .maybeSingle()

    if (!turistaDocumentosEnviados(turDocs)) {
      return NextResponse.json({ error: MSG_PRE_LIBERACAO_REQUER_DOCS }, { status: 400 })
    }

    const prof = await buscarProfissionalVerificadoPorUsername(adminDb, codigo)
    if (!prof.ok) {
      const msg =
        prof.error === 'profissional_nao_verificado'
          ? 'Este profissional ainda não está verificado no app.'
          : 'Profissional não encontrado. Use o username exato (sem @).'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const { data: pendente } = await adminDb
      .from('turista_pre_liberacoes')
      .select('id')
      .eq('turista_usuario_id', session.userId)
      .eq('profissional_usuario_id', prof.usuarioId)
      .eq('status', 'pendente')
      .maybeSingle()

    if (pendente?.id) {
      return NextResponse.json(
        { error: 'Já existe uma solicitação pendente para este profissional.' },
        { status: 409 },
      )
    }

    const { data: tur } = await adminDb
      .from('turistas')
      .select('nome_usuario, nome_completo')
      .eq('usuario_id', session.userId)
      .maybeSingle()

    const turistaUsername = String(tur?.nome_usuario ?? '').trim()
    const turistaNome = String(tur?.nome_completo ?? 'Turista').trim()

    const { data: sol, error: insErr } = await adminDb
      .from('turista_pre_liberacoes')
      .insert({
        turista_usuario_id: session.userId,
        profissional_usuario_id: prof.usuarioId,
        profissional_id: prof.profissionalId,
        prof_username: prof.nomeUsuario,
        turista_username: turistaUsername || null,
        turista_nome: turistaNome,
        status: 'pendente',
      })
      .select('id')
      .single()

    if (insErr || !sol?.id) {
      return NextResponse.json({ error: insErr?.message ?? 'Erro ao registrar solicitação.' }, { status: 500 })
    }

    const aviso = await inserirAvisoPreLiberacaoCanalFinanceiro(adminDb, {
      profissionalId: prof.profissionalId,
      solicitacaoId: String(sol.id),
      turistaUsername: turistaUsername || session.userId.slice(0, 8),
      turistaNome,
      profUsername: prof.nomeUsuario,
    })

    if (aviso.ok && aviso.canalFinanceiroId) {
      await adminDb
        .from('turista_pre_liberacoes')
        .update({ canal_financeiro_id: aviso.canalFinanceiroId })
        .eq('id', sol.id)
    }

    return NextResponse.json({
      ok: true,
      mensagem: `Solicitação enviada para @${prof.nomeUsuario}. Aguarde a confirmação no canal financeiro do profissional.`,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
