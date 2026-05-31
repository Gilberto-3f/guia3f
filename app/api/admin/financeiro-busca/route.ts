import { NextResponse } from 'next/server'
import { assertAdminSession } from '@/lib/adminApiAuth'
import { buscarDestinatariosFinanceiro, type AlvoTipoFinanceiro } from '@/lib/financeiroConversas'

export async function GET(req: Request) {
  const auth = await assertAdminSession()
  if ('error' in auth && auth.error) return auth.error

  const url = new URL(req.url)
  const tipo = url.searchParams.get('tipo') === 'empresa' ? 'empresa' : 'profissional'
  const q = String(url.searchParams.get('q') ?? '')

  const resultados = await buscarDestinatariosFinanceiro(auth.supabase, tipo as AlvoTipoFinanceiro, q)
  return NextResponse.json({ ok: true, resultados })
}
