import { NextResponse } from 'next/server'
import { assertAdminSession } from '@/lib/adminApiAuth'
import { listarAlertasUrgentesAdm, marcarAlertaUrgenteVisto } from '@/lib/ecossistemaConversas'

export async function GET() {
  const auth = await assertAdminSession()
  if (!auth.ok) return auth.error

  const alertas = await listarAlertasUrgentesAdm(auth.supabase, { motivo: 'perdido' })
  return NextResponse.json({ ok: true, alertas })
}

export async function PATCH(req: Request) {
  const auth = await assertAdminSession()
  if (!auth.ok) return auth.error

  const body = (await req.json()) as Record<string, unknown>
  const conversaId = String(body.conversa_id ?? '').trim()
  if (!conversaId) {
    return NextResponse.json({ error: 'conversa_id obrigatório.' }, { status: 400 })
  }

  const res = await marcarAlertaUrgenteVisto(auth.supabase, conversaId)
  if (!res.ok) {
    return NextResponse.json({ error: res.error ?? 'Erro.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
