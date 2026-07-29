import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'

/** Lista / cria / remove disponibilidade (placa vermelha). */
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

  const hoje = new Date()
  const ymd = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`

  const { data, error } = await admin
    .from('mobilidade_disponibilidade')
    .select('id, data, hora_inicio, hora_fim, vagas_total, vagas_ocupadas, ativo')
    .eq('profissional_id', prof.id)
    .gte('data', ymd)
    .order('data', { ascending: true })
    .order('hora_inicio', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    slots: (data ?? []).map((s) => ({
      id: String(s.id),
      data: String(s.data),
      hora_inicio: String(s.hora_inicio).slice(0, 5),
      hora_fim: String(s.hora_fim).slice(0, 5),
      vagas_total: Number(s.vagas_total),
      vagas_ocupadas: Number(s.vagas_ocupadas),
      vagas_livres: Number(s.vagas_total) - Number(s.vagas_ocupadas),
      ativo: Boolean(s.ativo),
    })),
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

  const data = String(body.data ?? '').trim()
  const horaInicio = String(body.hora_inicio ?? '08:00').trim().slice(0, 5)
  const horaFim = String(body.hora_fim ?? '20:00').trim().slice(0, 5)
  const vagas = Math.max(1, Math.min(50, Number(body.vagas_total) || 1))

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json({ error: 'Data inválida (YYYY-MM-DD).' }, { status: 400 })
  }
  if (horaFim <= horaInicio) {
    return NextResponse.json({ error: 'hora_fim deve ser após hora_inicio.' }, { status: 400 })
  }

  const { data: row, error } = await admin
    .from('mobilidade_disponibilidade')
    .upsert(
      {
        profissional_id: prof.id,
        data,
        hora_inicio: horaInicio,
        hora_fim: horaFim,
        vagas_total: vagas,
        ativo: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'profissional_id,data,hora_inicio' },
    )
    .select('id, data, hora_inicio, hora_fim, vagas_total, vagas_ocupadas, ativo')
    .maybeSingle()

  if (error || !row) {
    return NextResponse.json({ error: error?.message ?? 'Falha ao salvar.' }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    slot: {
      id: String(row.id),
      data: String(row.data),
      hora_inicio: String(row.hora_inicio).slice(0, 5),
      hora_fim: String(row.hora_fim).slice(0, 5),
      vagas_total: Number(row.vagas_total),
      vagas_ocupadas: Number(row.vagas_ocupadas),
      ativo: Boolean(row.ativo),
    },
  })
}

export async function DELETE(req: Request) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  const url = new URL(req.url)
  const id = String(url.searchParams.get('id') ?? '').trim()
  if (!id) return NextResponse.json({ error: 'id obrigatório.' }, { status: 400 })

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

  const { data: slot } = await admin
    .from('mobilidade_disponibilidade')
    .select('id, vagas_ocupadas')
    .eq('id', id)
    .eq('profissional_id', prof.id)
    .maybeSingle()

  if (!slot) return NextResponse.json({ error: 'Slot não encontrado.' }, { status: 404 })
  if (Number(slot.vagas_ocupadas) > 0) {
    await admin
      .from('mobilidade_disponibilidade')
      .update({ ativo: false, updated_at: new Date().toISOString() })
      .eq('id', id)
    return NextResponse.json({ ok: true, desativado: true })
  }

  await admin.from('mobilidade_disponibilidade').delete().eq('id', id)
  return NextResponse.json({ ok: true, removido: true })
}
