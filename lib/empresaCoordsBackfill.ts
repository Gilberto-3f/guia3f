import type { SupabaseClient } from '@supabase/supabase-js'
import {
  forwardGeocodeMapbox,
  montarQueryEnderecoEmpresa,
  type GeoPoint,
} from '@/lib/mapboxForwardGeocode'

/** Centros aproximados da Tríplice Fronteira (último recurso se Mapbox falhar). */
const CENTRO_CIDADE: Record<string, GeoPoint> = {
  'foz do iguacu': { lat: -25.5165, lng: -54.585 },
  'ciudad del este': { lat: -25.5097, lng: -54.6111 },
  'puerto iguazu': { lat: -25.5972, lng: -54.5735 },
}

function normalizarCidadeKey(cidade: string): string {
  return String(cidade ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function hashId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Desloca ~50–150 m para não empilhar pins no mesmo ponto. */
function comOffsetDeterministico(base: GeoPoint, empresaId: string): GeoPoint {
  const h = hashId(empresaId)
  const dLat = ((h % 200) - 100) * 0.00008
  const dLng = (((Math.floor(h / 200) % 200) - 100) * 0.00008)
  return { lat: base.lat + dLat, lng: base.lng + dLng }
}

function fallbackCentroCidade(cidadeOuTexto: string, empresaId: string): GeoPoint | null {
  const key = normalizarCidadeKey(cidadeOuTexto)
  const base =
    CENTRO_CIDADE[key] ??
    (key.includes('foz')
      ? CENTRO_CIDADE['foz do iguacu']
      : key === 'cde' ||
          key.includes('ciudad del este') ||
          key.includes('cidade do leste') ||
          key.includes('ciudad del') ||
          (key.includes('este') && (key.includes('ciudad') || key.includes('cidade')))
        ? CENTRO_CIDADE['ciudad del este']
        : key.includes('iguaz') || key.includes('puerto')
          ? CENTRO_CIDADE['puerto iguazu']
          : null)
  if (!base) return null
  return comOffsetDeterministico(base, empresaId)
}

/**
 * Resolve lat/lng (Mapbox + fallback Tríplice) sem persistir — útil no salvar do drawer.
 * Sempre tenta centro da cidade a partir de cidade/bairro/endereço (cobre CDE e agências).
 */
export async function resolverCoordsEmpresa(opts: {
  id?: string | null
  endereco?: string | null
  bairro?: string | null
  cidade?: string | null
}): Promise<GeoPoint | null> {
  const id = String(opts.id ?? 'tmp')
  const cidade = String(opts.cidade ?? '').trim()
  const endereco = String(opts.endereco ?? '').trim()
  const bairro = String(opts.bairro ?? '').trim()
  const blob = [endereco, bairro, cidade].filter(Boolean).join(', ')

  const query = montarQueryEnderecoEmpresa({
    endereco,
    bairro,
    cidade,
  })

  let geo: GeoPoint | null = null
  if (query.length >= 5) {
    geo = await forwardGeocodeMapbox(query)
  }
  if (!geo && cidade.length >= 5) {
    geo = await forwardGeocodeMapbox(cidade)
  }
  if (!geo) {
    geo = fallbackCentroCidade(cidade, id)
  }
  if (!geo && blob) {
    geo = fallbackCentroCidade(blob, id)
  }
  // Último recurso Tríplice: endereço BR/PY típico sem cidade legível
  if (!geo && blob.length >= 5) {
    const n = normalizarCidadeKey(blob)
    if (n.includes('paragu') || n.includes('avenida') || n.includes('calle')) {
      geo = fallbackCentroCidade('ciudad del este', id)
    } else if (n.includes('brasil') || n.includes('rua ') || n.includes('avenida')) {
      geo = fallbackCentroCidade('foz do iguacu', id)
    }
  }
  return geo
}

export type EmpresaSemCoords = {
  id: string
  endereco?: string | null
  bairro?: string | null
  cidade?: string | null
}

/**
 * Geocodifica e persiste lat/lng para empresas regulares sem coordenada.
 * Processa em lotes concorrentes (evita estourar Mapbox + timeout serverless).
 */
export async function backfillCoordsEmpresas(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient | any,
  empresas: EmpresaSemCoords[],
  opts?: { maxPorRequest?: number; concurrency?: number },
): Promise<Map<string, GeoPoint>> {
  const max = Math.max(1, opts?.maxPorRequest ?? 100)
  const concurrency = Math.max(1, Math.min(16, opts?.concurrency ?? 8))
  const preenchidos = new Map<string, GeoPoint>()
  const fila = empresas.filter((e) => e?.id).slice(0, max)

  const processarUma = async (emp: EmpresaSemCoords) => {
    const id = String(emp.id)
    const geo = await resolverCoordsEmpresa({
      id,
      endereco: emp.endereco,
      bairro: emp.bairro,
      cidade: emp.cidade,
    })
    if (!geo) return

    const { error } = await supabase
      .from('empresas')
      .update({ latitude: geo.lat, longitude: geo.lng })
      .eq('id', id)

    if (!error) {
      preenchidos.set(id, geo)
    }
  }

  for (let i = 0; i < fila.length; i += concurrency) {
    const batch = fila.slice(i, i + concurrency)
    await Promise.all(batch.map((emp) => processarUma(emp)))
  }

  return preenchidos
}
