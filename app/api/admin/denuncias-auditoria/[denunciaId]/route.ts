import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { assertAdminSession } from '@/lib/adminApiAuth'
import { carregarConteudoDenuncia } from '@/lib/carregarConteudoDenuncia'
import { listarLeiturasDenunciaAuditoria, registrarLeituraDenunciaAuditoria } from '@/lib/denunciaAuditoriaLeitura'

type RouteCtx = { params: Promise<{ denunciaId: string }> }

async function carregarDenunciaCompleta(supabase: SupabaseClient, denunciaId: string) {
  const { data: log, error } = await supabase.from('denuncias').select('*').eq('id', denunciaId).maybeSingle()
  if (error || !log) return null

  const row = log as Record<string, unknown>
  const [denunciante, responsavel, conteudo] = await Promise.all([
    supabase.from('usuarios').select('email, username').eq('id', String(row.denunciante_id)).maybeSingle(),
    row.responsavel_id
      ? supabase.from('usuarios').select('email, username').eq('id', String(row.responsavel_id)).maybeSingle()
      : Promise.resolve({ data: null }),
    carregarConteudoDenuncia(supabase, {
      conteudoTipo: row.conteudo_tipo != null ? String(row.conteudo_tipo) : null,
      conteudoId: row.conteudo_id != null ? String(row.conteudo_id) : null,
      denunciadoTipo: row.denunciado_tipo != null ? String(row.denunciado_tipo) : undefined,
      denunciadoId: row.denunciado_id != null ? String(row.denunciado_id) : undefined,
    }),
  ])

  return {
    denuncia: log,
    denunciante: denunciante.data,
    responsavel: responsavel.data,
    conteudo,
  }
}

export async function GET(_req: Request, ctx: RouteCtx) {
  const auth = await assertAdminSession()
  if (!auth.ok) return auth.error

  const { denunciaId } = await ctx.params
  const payload = await carregarDenunciaCompleta(auth.supabase, denunciaId)
  if (!payload) {
    return NextResponse.json({ ok: false, error: 'Denúncia não encontrada.' }, { status: 404 })
  }

  const leituras = await listarLeiturasDenunciaAuditoria(auth.supabase, denunciaId)
  return NextResponse.json({ ok: true, ...payload, leituras })
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  const auth = await assertAdminSession()
  if (!auth.ok) return auth.error

  const { denunciaId } = await ctx.params
  const body = (await req.json()) as Record<string, unknown>
  const acao = body.acao != null ? String(body.acao) : ''

  if (acao !== 'registrar_acesso') {
    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  }

  const { data: den } = await auth.supabase.from('denuncias').select('status').eq('id', denunciaId).maybeSingle()
  if (!den || String(den.status) !== 'arquivada') {
    return NextResponse.json({ error: 'Denúncia arquivada não encontrada.' }, { status: 404 })
  }

  const leitura = await registrarLeituraDenunciaAuditoria(auth.supabase, {
    denunciaId,
    admUsuarioId: auth.userId,
  })

  return NextResponse.json({ ok: true, leitura })
}
