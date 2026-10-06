import { NextResponse } from 'next/server'
import { repararLeituraDegustacaoConcluidaEmpresa } from '@/lib/canalFinanceiroEmpresaLeitura.server'
import { assertUserSession } from '@/lib/apiUserSession'

/** Repara canal_financeiro de degustações já aceitas/encerradas (não marca convites pendentes). */
export async function POST() {
  try {
    const session = await assertUserSession()
    if (!session.ok) return session.error

    const { data: emp } = await session.supabase
      .from('empresas')
      .select('id')
      .eq('usuario_id', session.userId)
      .maybeSingle()
    const empresaId = emp?.id != null ? String(emp.id) : ''
    if (!empresaId) {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
    }

    const admin = session.supabase
    await repararLeituraDegustacaoConcluidaEmpresa(admin, empresaId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
