import { NextResponse } from 'next/server'
import { assertAdminSession } from '@/lib/adminApiAuth'
import { registrarLogConversaFinanceiro } from '@/lib/financeiroConversaAuditoria'
import { encerrarConversaFinanceiro, listarMensagensConversa } from '@/lib/financeiroConversas'

type RouteCtx = { params: Promise<{ conversaId: string }> }

export async function GET(_req: Request, ctx: RouteCtx) {
  const auth = await assertAdminSession()
  if (!auth.ok) return auth.error

  const { conversaId } = await ctx.params
  const { data: conversa, error } = await auth.supabase
    .from('financeiro_conversas')
    .select('*')
    .eq('id', conversaId)
    .maybeSingle()

  if (error || !conversa) {
    return NextResponse.json({ ok: false, error: 'Conversa não encontrada.' }, { status: 404 })
  }

  const mensagens = await listarMensagensConversa(auth.supabase, conversaId)
  return NextResponse.json({
    ok: true,
    conversa: {
      ...conversa,
      assunto: conversa.assunto != null ? String(conversa.assunto) : null,
      adm_usuario_id: String(conversa.adm_usuario_id),
    },
    mensagens,
  })
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  const auth = await assertAdminSession()
  if (!auth.ok) return auth.error

  const { conversaId } = await ctx.params
  const body = (await req.json()) as Record<string, unknown>
  const acao = body.acao != null ? String(body.acao) : ''

  if (acao === 'registrar_acesso') {
    await registrarLogConversaFinanceiro(auth.supabase, {
      conversaId,
      admUsuarioId: auth.userId,
      acao: 'acessado',
    })
    return NextResponse.json({ ok: true })
  }

  if (acao !== 'encerrar') {
    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  }

  const res = await encerrarConversaFinanceiro(auth.supabase, conversaId, {
    admUsuarioId: auth.userId,
  })
  if (!res.ok) {
    return NextResponse.json({ error: res.error ?? 'Erro ao encerrar.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
