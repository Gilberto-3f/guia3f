import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { inserirParadasItinerario } from '@/lib/itinerarioParadas'

/** Turista adiciona atrativos ao manifesto ativo do profissional contratado. */
export async function POST(req: Request) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  const body = (await req.json()) as Record<string, unknown>
  const profissionalUsuarioId = String(body.profissional_usuario_id ?? '').trim()
  const empresaIds = Array.isArray(body.empresa_ids) ? body.empresa_ids.map(String).filter(Boolean) : []

  if (!profissionalUsuarioId || empresaIds.length === 0) {
    return NextResponse.json({ error: 'profissional_usuario_id e empresa_ids obrigatórios.' }, { status: 400 })
  }

  const { data: prof } = await auth.supabase
    .from('profissionais')
    .select('id, placa_vermelha')
    .eq('usuario_id', profissionalUsuarioId)
    .maybeSingle()

  if (!prof?.id || !prof.placa_vermelha) {
    return NextResponse.json({ error: 'Profissional não encontrado ou sem manifesto.' }, { status: 404 })
  }

  const dataHoje = new Date().toISOString().slice(0, 10)

  const { data: md } = await auth.supabase
    .from('manifesto_diario')
    .select('id')
    .eq('profissional_id', String(prof.id))
    .eq('data_manifesto', dataHoje)
    .not('status', 'in', '("cancelado","concluido")')
    .maybeSingle()

  if (!md?.id) {
    return NextResponse.json({ error: 'Nenhum manifesto ativo para hoje.' }, { status: 404 })
  }

  const { data: pass } = await auth.supabase
    .from('manifesto_passageiros')
    .select('profissional_indireto_id')
    .eq('manifesto_id', md.id)
    .eq('turista_id', auth.userId)
    .maybeSingle()

  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  await inserirParadasItinerario(admin, {
    manifestoId: String(md.id),
    turistaUsuarioId: auth.userId,
    empresaIds,
    profissionalIndiretoId: pass?.profissional_indireto_id != null ? String(pass.profissional_indireto_id) : null,
  })

  return NextResponse.json({ ok: true, manifesto_id: md.id })
}
