import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import {
  parseMobilidadeStatus,
  profissionalTemCategoriaMobilidade,
  type MobilidadeStatusId,
} from '@/lib/mobilidadeStatusProfissional'

type Body = {
  status?: string
  lat?: number | null
  lng?: number | null
  /** Só atualiza GPS sem mudar status. */
  heartbeat?: boolean
}

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
    .select(
      'id, categorias, mobilidade_status, mobilidade_status_em, mobilidade_online_desde, mobilidade_lat, mobilidade_lng',
    )
    .eq('usuario_id', auth.userId)
    .maybeSingle()

  if (!prof) {
    return NextResponse.json({ error: 'Perfil profissional não encontrado.' }, { status: 404 })
  }

  const cats = Array.isArray(prof.categorias) ? prof.categorias.map(String) : []
  const elegivel = profissionalTemCategoriaMobilidade(cats)

  return NextResponse.json({
    ok: true,
    elegivel,
    status: parseMobilidadeStatus(prof.mobilidade_status),
    status_em: prof.mobilidade_status_em,
    online_desde: prof.mobilidade_online_desde,
    lat: prof.mobilidade_lat != null ? Number(prof.mobilidade_lat) : null,
    lng: prof.mobilidade_lng != null ? Number(prof.mobilidade_lng) : null,
  })
}

export async function POST(req: Request) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  if (auth.role !== 'profissional') {
    return NextResponse.json({ error: 'Apenas profissionais.' }, { status: 403 })
  }

  let body: Body
  try {
    body = (await req.json()) as Body
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
    .select('id, categorias, mobilidade_status, mobilidade_online_desde')
    .eq('usuario_id', auth.userId)
    .maybeSingle()

  if (!prof?.id) {
    return NextResponse.json({ error: 'Perfil profissional não encontrado.' }, { status: 404 })
  }

  const cats = Array.isArray(prof.categorias) ? prof.categorias.map(String) : []
  if (!profissionalTemCategoriaMobilidade(cats)) {
    return NextResponse.json(
      { error: 'Sua categoria não usa status de Mobilidade.' },
      { status: 403 },
    )
  }

  const agora = new Date().toISOString()
  const lat =
    body.lat != null && Number.isFinite(Number(body.lat)) ? Number(body.lat) : null
  const lng =
    body.lng != null && Number.isFinite(Number(body.lng)) ? Number(body.lng) : null

  if (body.heartbeat === true) {
    const atual = parseMobilidadeStatus(prof.mobilidade_status)
    if (atual === 'offline') {
      return NextResponse.json({ ok: true, status: 'offline' })
    }
    const patch: Record<string, unknown> = { mobilidade_status_em: agora }
    if (lat != null && lng != null) {
      patch.mobilidade_lat = lat
      patch.mobilidade_lng = lng
    }
    await admin.from('profissionais').update(patch).eq('id', prof.id)
    return NextResponse.json({ ok: true, status: atual })
  }

  const next = parseMobilidadeStatus(body.status)
  const atual = parseMobilidadeStatus(prof.mobilidade_status)

  // Em atendimento só muda via fluxo de corrida (aceite/conclusão) — aqui só online/offline.
  if (next === 'em_atendimento') {
    return NextResponse.json(
      { error: 'Status em atendimento é definido ao aceitar uma corrida.' },
      { status: 400 },
    )
  }

  if (atual === 'em_atendimento' && (next === 'online' || next === 'offline')) {
    return NextResponse.json(
      { error: 'Conclua a corrida antes de alterar o status.' },
      { status: 400 },
    )
  }

  const patch: Record<string, unknown> = {
    mobilidade_status: next as MobilidadeStatusId,
    mobilidade_status_em: agora,
  }

  if (next === 'online') {
    if (lat == null || lng == null) {
      return NextResponse.json(
        { error: 'GPS necessário para ficar online.' },
        { status: 400 },
      )
    }
    patch.mobilidade_lat = lat
    patch.mobilidade_lng = lng
    patch.mobilidade_online_desde = agora
  }

  if (next === 'offline') {
    patch.mobilidade_online_desde = null
  }

  const { error } = await admin.from('profissionais').update(patch).eq('id', prof.id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    status: next,
    online_desde: next === 'online' ? agora : null,
  })
}
