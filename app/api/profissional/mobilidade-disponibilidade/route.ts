import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { carregarBloqueiosMobilidade, hojeIsoLocal } from '@/lib/mobilidadeBloqueiosCalendario'

/**
 * Calendário do profissional (placa vermelha):
 * GET — lista datas bloqueadas (demais dias = disponíveis).
 * POST — bloquear / desbloquear datas ({ acao, datas[] }).
 * DELETE — ?data=YYYY-MM-DD remove um bloqueio.
 */
export async function GET() {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  const { data: prof } = await admin
    .from('profissionais')
    .select('id, placa_vermelha')
    .eq('usuario_id', auth.userId)
    .maybeSingle()

  if (!prof?.id || !prof.placa_vermelha) {
    return NextResponse.json({ error: 'Acesso restrito a placa vermelha.' }, { status: 403 })
  }

  const bloqueios = await carregarBloqueiosMobilidade(admin, String(prof.id), {
    aPartirDe: hojeIsoLocal(),
  })

  return NextResponse.json({
    ok: true,
    bloqueios,
    /** Compat: UI antiga lia `slots` — vazio no modelo de bloqueio. */
    slots: [],
  })
}

export async function POST(req: Request) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  const { data: prof } = await admin
    .from('profissionais')
    .select('id, placa_vermelha')
    .eq('usuario_id', auth.userId)
    .maybeSingle()

  if (!prof?.id || !prof.placa_vermelha) {
    return NextResponse.json({ error: 'Acesso restrito a placa vermelha.' }, { status: 403 })
  }

  const acao = String(body.acao ?? 'bloquear').trim().toLowerCase()
  const datasRaw = Array.isArray(body.datas) ? body.datas : body.data != null ? [body.data] : []
  const datas = [
    ...new Set(
      datasRaw
        .map((d) => String(d ?? '').trim().slice(0, 10))
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)),
    ),
  ]
  const hoje = hojeIsoLocal()
  const futuras = datas.filter((d) => d >= hoje)

  if (futuras.length === 0) {
    return NextResponse.json({ error: 'Selecione ao menos uma data futura válida.' }, { status: 400 })
  }

  const profId = String(prof.id)

  if (acao === 'desbloquear') {
    const { error } = await admin
      .from('mobilidade_bloqueios_calendario')
      .delete()
      .eq('profissional_id', profId)
      .in('data', futuras)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, desbloqueadas: futuras.length })
  }

  // Compat legado: POST com hora_inicio ainda cria slot — ignorado no novo modelo;
  // se vier só `data`+horas, trata como bloquear essa data.
  const rows = futuras.map((data) => ({
    profissional_id: profId,
    data,
    motivo: 'Bloqueio manual (indisponível)',
  }))

  const { error } = await admin.from('mobilidade_bloqueios_calendario').upsert(rows, {
    onConflict: 'profissional_id,data',
    ignoreDuplicates: true,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, bloqueadas: futuras.length })
}

export async function DELETE(req: Request) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  const url = new URL(req.url)
  const data = String(url.searchParams.get('data') ?? '').trim().slice(0, 10)
  const id = String(url.searchParams.get('id') ?? '').trim()

  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  const { data: prof } = await admin
    .from('profissionais')
    .select('id, placa_vermelha')
    .eq('usuario_id', auth.userId)
    .maybeSingle()

  if (!prof?.id || !prof.placa_vermelha) {
    return NextResponse.json({ error: 'Acesso restrito a placa vermelha.' }, { status: 403 })
  }

  const profId = String(prof.id)

  if (id) {
    await admin
      .from('mobilidade_bloqueios_calendario')
      .delete()
      .eq('id', id)
      .eq('profissional_id', profId)
    return NextResponse.json({ ok: true, removido: true })
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json({ error: 'data ou id obrigatório.' }, { status: 400 })
  }

  await admin
    .from('mobilidade_bloqueios_calendario')
    .delete()
    .eq('profissional_id', profId)
    .eq('data', data)

  return NextResponse.json({ ok: true, removido: true })
}
