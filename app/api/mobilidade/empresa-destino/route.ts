import { NextResponse } from 'next/server'
import { assertUserSessionLight } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { resolverCoordsEmpresa } from '@/lib/empresaCoordsBackfill'
import { invalidarCachePresencaPublicaGlobal } from '@/lib/empresaPresencaPublica'

export type EmpresaDestinoMobilidade = {
  id: string
  nome_fantasia: string
  cidade: string
  endereco: string | null
  bairro: string | null
  latitude: number
  longitude: number
  foto_url: string | null
  categoria: string | null
  nome_usuario: string | null
  /** Texto para o campo "Para onde?" / autocomplete. */
  label_destino: string
}

function montarLabelDestino(opts: {
  nome: string
  endereco: string | null
  bairro: string | null
  cidade: string
}): string {
  const partes = [opts.endereco, opts.bairro, opts.cidade].map((p) => String(p ?? '').trim()).filter(Boolean)
  if (partes.length > 0) return partes.join(', ')
  return opts.nome.trim() || 'Destino'
}

/**
 * GET ?id= — dados da empresa para Chamar corrida / pin no mapa.
 * Se faltar lat/lng, geocodifica e persiste (service role) para o pin ficar estável.
 */
export async function GET(req: Request) {
  const auth = await assertUserSessionLight()
  if (!auth.ok) return auth.error

  const id = String(new URL(req.url).searchParams.get('id') ?? '').trim()
  if (!id) {
    return NextResponse.json({ error: 'id obrigatório.' }, { status: 400 })
  }

  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  const { data: emp, error } = await admin
    .from('empresas')
    .select(
      'id, nome_fantasia, nome_usuario, cidade, endereco, bairro, latitude, longitude, foto_url, categoria, docs_verificado, status, somente_modo_apresentacao',
    )
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  if (!emp?.id) {
    return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
  }

  let lat = Number(emp.latitude)
  let lng = Number(emp.longitude)
  let geocoded = false

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    const geo = await resolverCoordsEmpresa({
      id: String(emp.id),
      endereco: emp.endereco != null ? String(emp.endereco) : null,
      bairro: emp.bairro != null ? String(emp.bairro) : null,
      cidade: emp.cidade != null ? String(emp.cidade) : null,
    })
    if (!geo) {
      return NextResponse.json(
        { error: 'Empresa sem coordenadas e geocode indisponível.' },
        { status: 422 },
      )
    }
    lat = geo.lat
    lng = geo.lng
    geocoded = true
    const { error: updErr } = await admin
      .from('empresas')
      .update({ latitude: lat, longitude: lng })
      .eq('id', emp.id)
    if (!updErr) {
      invalidarCachePresencaPublicaGlobal()
    }
  }

  const nome = String(emp.nome_fantasia ?? '')
  const cidade = String(emp.cidade ?? '')
  const endereco =
    emp.endereco != null && String(emp.endereco).trim() ? String(emp.endereco).trim() : null
  const bairro =
    emp.bairro != null && String(emp.bairro).trim() ? String(emp.bairro).trim() : null

  const payload: EmpresaDestinoMobilidade = {
    id: String(emp.id),
    nome_fantasia: nome,
    cidade,
    endereco,
    bairro,
    latitude: lat,
    longitude: lng,
    foto_url: emp.foto_url != null ? String(emp.foto_url) : null,
    categoria: emp.categoria != null ? String(emp.categoria) : null,
    nome_usuario: emp.nome_usuario != null ? String(emp.nome_usuario).replace(/^@+/, '') : null,
    label_destino: montarLabelDestino({ nome, endereco, bairro, cidade }),
  }

  return NextResponse.json({ ok: true, empresa: payload, geocoded })
}
