import { NextResponse } from 'next/server'
import { inserirNotificacaoCanalFinanceiroProfissional } from '@/lib/canalFinanceiroProfissional'
import type { TipoNotificacaoFinanceiroProfissional } from '@/lib/canalFinanceiroProfissional'
import { assertAdminSession } from '@/lib/adminApiAuth'

const TIPOS_VALIDOS: TipoNotificacaoFinanceiroProfissional[] = [
  'mensagem_adm',
  'recibo_atendimento',
  'extrato_parceria',
  'extrato_comissao',
  'manifesto_indicacao',
]

/** ADM envia notificação ao canal financeiro privado de um profissional. */
export async function POST(req: Request) {
  try {
    const auth = await assertAdminSession()
    if (!auth.ok) return auth.error

    const body = (await req.json()) as Record<string, unknown>
    const profissionalUsuarioId = String(body.profissional_usuario_id ?? '').trim()
    const titulo = String(body.titulo ?? '').trim()
    const mensagem = body.mensagem != null ? String(body.mensagem) : null
    const tipoRaw = String(body.tipo ?? 'mensagem_adm').trim() as TipoNotificacaoFinanceiroProfissional
    const empresaId = body.empresa_id != null ? String(body.empresa_id).trim() : null
    const valor = body.valor != null ? Number(body.valor) : null

    if (!profissionalUsuarioId || !titulo) {
      return NextResponse.json({ error: 'profissional_usuario_id e titulo são obrigatórios.' }, { status: 400 })
    }

    if (!TIPOS_VALIDOS.includes(tipoRaw)) {
      return NextResponse.json({ error: 'tipo inválido.' }, { status: 400 })
    }

    const res = await inserirNotificacaoCanalFinanceiroProfissional(auth.supabase, {
      profissionalUsuarioId,
      tipo: tipoRaw,
      titulo,
      mensagem,
      valor: Number.isFinite(valor) ? valor : null,
      empresaId: empresaId || null,
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
