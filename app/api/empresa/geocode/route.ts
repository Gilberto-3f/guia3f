import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { resolverCoordsEmpresa } from '@/lib/empresaCoordsBackfill'
import { invalidarCachePresencaPublicaGlobal } from '@/lib/empresaPresencaPublica'

/**
 * Geocodifica e persiste lat/lng da empresa do gestor (ou ADM).
 * Usado ao salvar Editar Página e para reparar contas sem coordenadas.
 */
export async function POST(req: Request) {
  const auth = await assertUserSession()
  if (!auth.ok) return auth.error

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const empresaId = String(body.empresa_id ?? '').trim()
  if (!empresaId) {
    return NextResponse.json({ error: 'empresa_id obrigatório.' }, { status: 400 })
  }

  let admin
  try {
    admin = createSupabaseAdmin()
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 })
  }

  const { data: emp } = await admin
    .from('empresas')
    .select('id, usuario_id, endereco, bairro, cidade, latitude, longitude')
    .eq('id', empresaId)
    .maybeSingle()

  if (!emp?.id) {
    return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 })
  }

  const ehDono = String(emp.usuario_id) === auth.userId
  if (!ehDono && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }

  const endereco =
    body.endereco != null ? String(body.endereco).trim() : emp.endereco != null ? String(emp.endereco) : ''
  const bairro =
    body.bairro != null ? String(body.bairro).trim() : emp.bairro != null ? String(emp.bairro) : ''
  const cidade =
    body.cidade != null ? String(body.cidade).trim() : emp.cidade != null ? String(emp.cidade) : ''

  const geo = await resolverCoordsEmpresa({
    id: empresaId,
    endereco: endereco || null,
    bairro: bairro || null,
    cidade: cidade || null,
  })

  if (!geo) {
    return NextResponse.json(
      { error: 'Não foi possível resolver coordenadas para este endereço.' },
      { status: 422 },
    )
  }

  const { error } = await admin
    .from('empresas')
    .update({ latitude: geo.lat, longitude: geo.lng })
    .eq('id', empresaId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  invalidarCachePresencaPublicaGlobal()

  return NextResponse.json({
    ok: true,
    latitude: geo.lat,
    longitude: geo.lng,
  })
}
