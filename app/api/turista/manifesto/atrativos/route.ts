import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { inserirParadasItinerario, listarParadasManifesto } from '@/lib/itinerarioParadas'

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

/** Lista as paradas que este turista marcou no manifesto elegível. */
export async function GET() {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  const hoje = new Date().toISOString().slice(0, 10)
  const { data: rows } = await auth.supabase
    .from('manifesto_passageiros')
    .select(
      `
      manifesto_id,
      manifesto:manifesto_id (id, data_manifesto, status)
    `,
    )
    .eq('turista_id', auth.userId)

  type Cand = { manifestoId: string; data: string }
  const cands: Cand[] = []
  for (const r of rows ?? []) {
    const m = r.manifesto as
      | { id?: string; data_manifesto?: string; status?: string }
      | { id?: string; data_manifesto?: string; status?: string }[]
      | null
    const md = Array.isArray(m) ? m[0] : m
    if (!md?.id) continue
    const st = String(md.status ?? '')
    if (st === 'cancelado' || st === 'concluido') continue
    const data = String(md.data_manifesto ?? '').slice(0, 10)
    if (data < hoje) continue
    cands.push({ manifestoId: String(md.id), data })
  }
  if (cands.length === 0) {
    return NextResponse.json({ ok: true, paradas: [] as unknown[], manifesto_id: null })
  }
  cands.sort((a, b) => a.data.localeCompare(b.data))
  const escolhido = cands.find((c) => c.data === hoje) ?? cands[0]

  const todas = await listarParadasManifesto(auth.supabase, escolhido.manifestoId)
  const paradas = todas.filter((p) => p.turista_id === auth.userId)

  return NextResponse.json({
    ok: true,
    manifesto_id: escolhido.manifestoId,
    paradas,
  })
}
