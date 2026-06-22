import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { buscarProfissionalPlacaVermelha, concluirManifestoDiario } from '@/lib/manifestoDiario'

/** Conclui manifesto diário após todos os check-ins. */
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

  const res = await concluirManifestoDiario(auth.supabase, manifestoId, prof.id)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
