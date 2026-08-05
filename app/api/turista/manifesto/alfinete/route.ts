import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { inserirParadasItinerario } from '@/lib/itinerarioParadas'

function hojeIso(): string {
  return new Date().toISOString().slice(0, 10)
}

type ManifestoCtx = {
  manifestoId: string
  data: string
  profissionalIndiretoId: string | null
}

/**
 * Manifesto elegível do turista: hoje ou data futura (agendamento já no manifesto).
 * Preferência: manifesto de hoje; senão o mais próximo com data >= hoje.
 */
async function resolverManifestoTurista(
  supabase: SupabaseClient,
  turistaId: string,
): Promise<ManifestoCtx | null> {
  const hoje = hojeIso()

  const { data: rows } = await supabase
    .from('manifesto_passageiros')
    .select(
      `
      id,
      manifesto_id,
      profissional_indireto_id,
      manifesto:manifesto_id (id, data_manifesto, status)
    `,
    )
    .eq('turista_id', turistaId)

  const cands: ManifestoCtx[] = []
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
    cands.push({
      manifestoId: String(md.id),
      data,
      profissionalIndiretoId:
        r.profissional_indireto_id != null ? String(r.profissional_indireto_id) : null,
    })
  }

  if (cands.length === 0) return null
  cands.sort((a, b) => a.data.localeCompare(b.data))
  return cands.find((c) => c.data === hoje) ?? cands[0]
}

/** GET: elegibilidade + se empresa já está no itinerário. */
export async function GET(req: Request) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  const empresaId = String(new URL(req.url).searchParams.get('empresa_id') ?? '').trim()
  if (!empresaId) {
    return NextResponse.json({ error: 'empresa_id obrigatório.' }, { status: 400 })
  }

  const ctx = await resolverManifestoTurista(auth.supabase, auth.userId)
  if (!ctx) {
    return NextResponse.json({ ok: true, elegivel: false, fixado: false, manifesto_id: null })
  }

  const { data: parada } = await auth.supabase
    .from('itinerario_paradas')
    .select('id')
    .eq('manifesto_id', ctx.manifestoId)
    .eq('turista_id', auth.userId)
    .eq('empresa_id', empresaId)
    .maybeSingle()

  return NextResponse.json({
    ok: true,
    elegivel: true,
    fixado: Boolean(parada?.id),
    manifesto_id: ctx.manifestoId,
    data_manifesto: ctx.data,
  })
}

/** POST: fixa empresa no itinerário (alfinete). */
export async function POST(req: Request) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  const body = (await req.json()) as Record<string, unknown>
  const empresaId = String(body.empresa_id ?? '').trim()
  if (!empresaId) {
    return NextResponse.json({ error: 'empresa_id obrigatório.' }, { status: 400 })
  }

  const ctx = await resolverManifestoTurista(auth.supabase, auth.userId)
  if (!ctx) {
    return NextResponse.json(
      { error: 'Você precisa estar no manifesto do dia ou ter agendamento futuro.' },
      { status: 403 },
    )
  }

  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  await inserirParadasItinerario(admin, {
    manifestoId: ctx.manifestoId,
    turistaUsuarioId: auth.userId,
    empresaIds: [empresaId],
    profissionalIndiretoId: ctx.profissionalIndiretoId,
  })

  return NextResponse.json({ ok: true, manifesto_id: ctx.manifestoId, fixado: true })
}

/** DELETE: remove alfinete / parada. */
export async function DELETE(req: Request) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  const empresaId = String(new URL(req.url).searchParams.get('empresa_id') ?? '').trim()
  if (!empresaId) {
    return NextResponse.json({ error: 'empresa_id obrigatório.' }, { status: 400 })
  }

  const ctx = await resolverManifestoTurista(auth.supabase, auth.userId)
  if (!ctx) {
    return NextResponse.json({ error: 'Sem manifesto elegível.' }, { status: 403 })
  }

  const { error } = await auth.supabase
    .from('itinerario_paradas')
    .delete()
    .eq('manifesto_id', ctx.manifestoId)
    .eq('turista_id', auth.userId)
    .eq('empresa_id', empresaId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, fixado: false })
}
