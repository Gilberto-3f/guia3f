import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { buscarProfissionalPlacaVermelha } from '@/lib/manifestoDiario'
import { iniciarListaManifesto } from '@/lib/manifestoLista'

/** INICIAR LISTA no manifesto do dia: ordena a fila e liga o atalho no mapa. */
export async function POST(req: Request) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  const prof = await buscarProfissionalPlacaVermelha(auth.supabase, auth.userId)
  if (!prof?.placa_vermelha) {
    return NextResponse.json({ error: 'Acesso restrito a profissionais com placa vermelha.' }, { status: 403 })
  }

  const body = (await req.json()) as Record<string, unknown>
  const manifestoId = String(body.manifesto_id ?? '').trim()
  if (!manifestoId) {
    return NextResponse.json({ error: 'manifesto_id obrigatório.' }, { status: 400 })
  }

  const res = await iniciarListaManifesto(auth.supabase, {
    manifestoId,
    profissionalId: prof.id,
  })
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
