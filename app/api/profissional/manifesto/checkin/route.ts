import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { buscarProfissionalPlacaVermelha, confirmarCheckInManifesto } from '@/lib/manifestoDiario'

/** Confirma check-in em atrativo (GPS ou manual). */
export async function POST(req: Request) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  const prof = await buscarProfissionalPlacaVermelha(auth.supabase, auth.userId)
  if (!prof?.placa_vermelha) {
    return NextResponse.json({ error: 'Acesso restrito a profissionais com placa vermelha.' }, { status: 403 })
  }

  const body = (await req.json()) as Record<string, unknown>
  const manifestoId = String(body.manifesto_id ?? '').trim()
  const empresaId = String(body.empresa_id ?? '').trim()
  const turistaId = body.turista_id != null ? String(body.turista_id) : null
  const metodoRaw = String(body.metodo ?? 'manual')
  const metodo = metodoRaw === 'gps' || metodoRaw === 'qr_code' ? metodoRaw : 'manual'

  if (!manifestoId || !empresaId) {
    return NextResponse.json({ error: 'manifesto_id e empresa_id obrigatórios.' }, { status: 400 })
  }

  const { data: md } = await auth.supabase
    .from('manifesto_diario')
    .select('id, status')
    .eq('id', manifestoId)
    .eq('profissional_id', prof.id)
    .maybeSingle()

  if (!md) return NextResponse.json({ error: 'Manifesto não encontrado.' }, { status: 404 })

  if (String(md.status) === 'rascunho') {
    await auth.supabase
      .from('manifesto_diario')
      .update({ status: 'em_andamento', updated_at: new Date().toISOString() })
      .eq('id', manifestoId)
  }

  const res = await confirmarCheckInManifesto(auth.supabase, {
    manifestoId,
    empresaId,
    turistaUsuarioId: turistaId,
    metodo,
  })

  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
