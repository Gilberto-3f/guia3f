import { NextResponse } from 'next/server'
import { inserirNotificacaoCanalFinanceiroEmpresa } from '@/lib/canalFinanceiroEmpresa'
import type { TipoNotificacaoFinanceiroEmpresa } from '@/lib/canalFinanceiroEmpresa'
import { assertAdminSession } from '@/lib/adminApiAuth'

const TIPOS_VALIDOS: TipoNotificacaoFinanceiroEmpresa[] = [
  'mensagem_adm',
  'comprovante_pagamento',
  'relatorio_pax',
  'relatorio_parceria',
  'extrato_comissao_paga',
  'pagamento_pendente',
  'plano_assinatura',
  'degustacao_plano',
  'lembrete_vencimento_plano',
]

/** ADM envia notificação ao canal financeiro privado de uma empresa. */
export async function POST(req: Request) {
  try {
    const auth = await assertAdminSession()
    if (!auth.ok) return auth.error

    const body = (await req.json()) as Record<string, unknown>
    const empresaUsuarioId = String(body.empresa_usuario_id ?? '').trim()
    const titulo = String(body.titulo ?? '').trim()
    const mensagem = body.mensagem != null ? String(body.mensagem) : null
    const tipoRaw = String(body.tipo ?? 'mensagem_adm').trim() as TipoNotificacaoFinanceiroEmpresa
    const valor = body.valor != null ? Number(body.valor) : null

    if (!empresaUsuarioId || !titulo) {
      return NextResponse.json({ error: 'empresa_usuario_id e titulo são obrigatórios.' }, { status: 400 })
    }

    if (!TIPOS_VALIDOS.includes(tipoRaw)) {
      return NextResponse.json({ error: 'tipo inválido.' }, { status: 400 })
    }

    const res = await inserirNotificacaoCanalFinanceiroEmpresa(auth.supabase, {
      empresaUsuarioId,
      tipo: tipoRaw,
      titulo,
      mensagem,
      valor: Number.isFinite(valor) ? valor : null,
    })

    if (!res.ok) {
      return NextResponse.json({ error: res.error ?? 'Erro ao enviar.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: res.id })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
