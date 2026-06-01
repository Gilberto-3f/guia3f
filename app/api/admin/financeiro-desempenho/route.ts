import { NextResponse } from 'next/server'
import { assertAdminSession } from '@/lib/adminApiAuth'
import type { AlvoTipoFinanceiro } from '@/lib/financeiroConversas'
import { carregarDesempenhoFinanceiro } from '@/lib/financeiroDesempenho'

export async function GET(req: Request) {
  const auth = await assertAdminSession()
  if (!auth.ok) return auth.error

  const url = new URL(req.url)
  const tipo = url.searchParams.get('tipo') === 'empresa' ? 'empresa' : 'profissional'
  const usuarioId = String(url.searchParams.get('usuario_id') ?? '').trim()

  if (!usuarioId) {
    return NextResponse.json({ error: 'usuario_id obrigatório.' }, { status: 400 })
  }

  const desempenho = await carregarDesempenhoFinanceiro(
    auth.supabase,
    tipo as AlvoTipoFinanceiro,
    usuarioId,
  )

  if (!desempenho) {
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, tipo, desempenho })
}
