import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { assertAdminSession } from '@/lib/adminApiAuth'
import {
  isLogCadastroVerificacao,
  listarLeiturasCadastroAuditoria,
  registrarLeituraCadastroAuditoria,
  type TipoLogCadastro,
} from '@/lib/cadastroAuditoriaLeitura'

type RouteCtx = { params: Promise<{ logId: string }> }

async function carregarPerfilResumo(supabase: SupabaseClient, tipo: TipoLogCadastro, perfilId: string) {
  const table = tipo
  const { data } = await supabase
    .from(table)
    .select('id, nome_usuario, nome_completo, nome_fantasia, status, motivo_reprovacao, usuario_id')
    .eq('id', perfilId)
    .maybeSingle()

  if (!data) return null

  const row = data as Record<string, unknown>
  const nome =
    String(row.nome_fantasia ?? row.nome_completo ?? row.nome_usuario ?? '').trim() || '—'
  const username = String(row.nome_usuario ?? '').trim()
  return {
    id: String(row.id),
    nome,
    username: username.startsWith('@') ? username : username ? `@${username}` : '—',
    status: row.status != null ? String(row.status) : null,
    motivo_reprovacao: row.motivo_reprovacao != null ? String(row.motivo_reprovacao) : null,
    usuario_id: row.usuario_id != null ? String(row.usuario_id) : null,
  }
}

export async function GET(_req: Request, ctx: RouteCtx) {
  const auth = await assertAdminSession()
  if (!auth.ok) return auth.error

  const { logId } = await ctx.params

  const { data: log, error } = await auth.supabase.from('logs_verificacao').select('*').eq('id', logId).maybeSingle()

  if (error || !log) {
    return NextResponse.json({ ok: false, error: 'Registro não encontrado.' }, { status: 404 })
  }

  const tipo = log.tipo != null ? String(log.tipo) : ''
  if (!isLogCadastroVerificacao(tipo)) {
    return NextResponse.json({ ok: false, error: 'Registro não pertence à auditoria de cadastros.' }, { status: 400 })
  }

  const perfilId = String(log.perfil_id ?? '')
  const [leituras, perfil] = await Promise.all([
    listarLeiturasCadastroAuditoria(auth.supabase, logId),
    perfilId ? carregarPerfilResumo(auth.supabase, tipo, perfilId) : Promise.resolve(null),
  ])

  return NextResponse.json({
    ok: true,
    log,
    leituras,
    perfil,
  })
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  const auth = await assertAdminSession()
  if (!auth.ok) return auth.error

  const { logId } = await ctx.params
  const body = (await req.json()) as Record<string, unknown>
  const acao = body.acao != null ? String(body.acao) : ''

  if (acao !== 'registrar_acesso') {
    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  }

  const { data: log } = await auth.supabase.from('logs_verificacao').select('tipo').eq('id', logId).maybeSingle()

  if (!log || !isLogCadastroVerificacao(log.tipo != null ? String(log.tipo) : '')) {
    return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 })
  }

  const leitura = await registrarLeituraCadastroAuditoria(auth.supabase, {
    logId,
    admUsuarioId: auth.userId,
  })

  return NextResponse.json({ ok: true, leitura })
}
