import { NextResponse } from 'next/server'
import { persistirLeituraCanalFinanceiroEmpresa } from '@/lib/canalFinanceiroEmpresaLeitura.server'
import { assertUserSession } from '@/lib/apiUserSession'

/** Empresa (ou anfitrião dual mode) marca aviso(s) do canal financeiro como lido(s). */
export async function POST(req: Request) {
  try {
    const session = await assertUserSession()
    if (!session.ok) return session.error

    const role = String(session.role ?? '')

    let empresaId = ''

    if (role === 'empresa') {
      const { data: emp } = await session.supabase
        .from('empresas')
        .select('id')
        .eq('usuario_id', session.userId)
        .maybeSingle()
      empresaId = emp?.id != null ? String(emp.id) : ''
    }

    // Profissional anfitrião (e fallback se role vier inconsistente): empresa de hospedagem vinculada.
    if (!empresaId && role !== 'turista' && role !== 'admin') {
      const { data: prof } = await session.supabase
        .from('profissionais')
        .select('empresa_hospedagem_id')
        .eq('usuario_id', session.userId)
        .maybeSingle()
      const empHosp =
        prof?.empresa_hospedagem_id != null ? String(prof.empresa_hospedagem_id).trim() : ''
      if (empHosp) empresaId = empHosp
    }

    if (!empresaId) {
      // Nada a marcar no escopo empresa (ex.: anfitrião só no modo social).
      return NextResponse.json({ ok: true, skipped: true })
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const itemId = String(body.item_id ?? '').trim() || undefined

    const ok = await persistirLeituraCanalFinanceiroEmpresa(session.supabase, empresaId, itemId)
    if (!ok) {
      return NextResponse.json({ error: 'Não foi possível marcar como lido.' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
