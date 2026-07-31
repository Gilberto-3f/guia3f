import { NextResponse } from 'next/server'
import { assertUserSession } from '@/lib/apiUserSession'
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { buscarEmpresasMapaMobilidade } from '@/lib/mobilidadeMapaEmpresas'
import {
  forwardGeocodeMapbox,
  montarQueryEnderecoEmpresa,
} from '@/lib/mapboxForwardGeocode'
import {
  aplicarFiltroEmpresasGuiaPlanoOuDegustacao,
  aplicarFiltroEmpresasGuiaPublico,
} from '@/lib/empresaGuiaVisibilidade'
import { buscarAssinaturasPresencaPublica, assinaturaContratadaVigente } from '@/lib/empresaAssinatura'

const COLUNAS_GEO =
  'id, nome_fantasia, nome_usuario, descricao_curta, categoria, cidade, endereco, bairro, status, docs_verificado, nota_media, total_avaliacoes, latitude, longitude, foto_url, whatsapp, plano, somente_anfitriao'

const MAX_GEOCODE_POR_REQUEST = 20

/**
 * Pins do mapa (server-side com service role).
 * Geocodifica e persiste lat/lng quando a empresa tem endereço mas ainda não tem coordenadas.
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

  // Completa coordenadas faltantes (cadastro grava null) a partir do endereço.
  try {
    await geocodificarEmpresasSemCoords(admin)
  } catch {
    /* mapa ainda tenta com o que já tem coords */
  }

  const { lista, error } = await buscarEmpresasMapaMobilidade(admin)
  if (error) {
    return NextResponse.json({ error, empresas: [] }, { status: 503 })
  }

  return NextResponse.json(
    { ok: true, empresas: lista },
    {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
      },
    },
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function geocodificarEmpresasSemCoords(admin: any) {
  const agora = new Date().toISOString()
  const [{ data: degRows }, assRows] = await Promise.all([
    admin
      .from('empresa_degustacoes')
      .select('empresa_id')
      .eq('status', 'ativa')
      .gt('expira_em', agora),
    buscarAssinaturasPresencaPublica(admin),
  ])

  const degIds = [
    ...new Set(
      ((degRows ?? []) as { empresa_id?: unknown }[])
        .map((r) => String(r.empresa_id ?? '').trim())
        .filter(Boolean),
    ),
  ]
  const assIds = [
    ...new Set(
      assRows
        .filter((r) => assinaturaContratadaVigente(r))
        .map((r) => String(r.empresa_id ?? '').trim())
        .filter(Boolean),
    ),
  ]

  const [pubRes, degRes, assRes] = await Promise.all([
    aplicarFiltroEmpresasGuiaPublico(
      admin.from('empresas').select(COLUNAS_GEO).is('latitude', null).not('endereco', 'is', null),
    ).limit(MAX_GEOCODE_POR_REQUEST),
    degIds.length
      ? aplicarFiltroEmpresasGuiaPlanoOuDegustacao(
          admin.from('empresas').select(COLUNAS_GEO).in('id', degIds.slice(0, 40)).is('latitude', null),
        ).limit(MAX_GEOCODE_POR_REQUEST)
      : Promise.resolve({ data: [], error: null }),
    assIds.length
      ? aplicarFiltroEmpresasGuiaPlanoOuDegustacao(
          admin.from('empresas').select(COLUNAS_GEO).in('id', assIds.slice(0, 40)).is('latitude', null),
        ).limit(MAX_GEOCODE_POR_REQUEST)
      : Promise.resolve({ data: [], error: null }),
  ])

  const byId = new Map<string, Record<string, unknown>>()
  for (const row of [
    ...((pubRes.data ?? []) as Record<string, unknown>[]),
    ...((degRes.data ?? []) as Record<string, unknown>[]),
    ...((assRes.data ?? []) as Record<string, unknown>[]),
  ]) {
    const id = String(row.id ?? '')
    if (id) byId.set(id, row)
  }

  const candidatos = [...byId.values()].slice(0, MAX_GEOCODE_POR_REQUEST)
  for (const row of candidatos) {
    const id = String(row.id ?? '')
    const query = montarQueryEnderecoEmpresa({
      endereco: row.endereco as string | null,
      bairro: row.bairro as string | null,
      cidade: row.cidade as string | null,
    })
    if (!id || query.length < 5) continue
    const geo = await forwardGeocodeMapbox(query)
    if (!geo) continue
    await admin
      .from('empresas')
      .update({ latitude: geo.lat, longitude: geo.lng })
      .eq('id', id)
  }
}
