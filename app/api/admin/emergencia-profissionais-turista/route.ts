import { NextResponse } from 'next/server'
import { assertAdminSession } from '@/lib/adminApiAuth'
import { fetchUltimosProfissionaisAtendimentoTurista } from '@/lib/emergenciaTurista'

/** ADM: últimos profissionais que atenderam o turista (item esquecido). */
export async function GET(req: Request) {
  const auth = await assertAdminSession()
  if (!auth.ok) return auth.error

  const url = new URL(req.url)
  const turistaId = String(url.searchParams.get('turista_id') ?? '').trim()
  if (!turistaId) {
    return NextResponse.json({ error: 'turista_id obrigatório.' }, { status: 400 })
  }

  const profissionais = await fetchUltimosProfissionaisAtendimentoTurista(auth.supabase, turistaId, 3)
  return NextResponse.json({ ok: true, profissionais })
}
