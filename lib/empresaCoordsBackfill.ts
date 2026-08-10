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

function fallbackCentroCidade(cidade: string, empresaId: string): GeoPoint | null {
  const key = normalizarCidadeKey(cidade)
  const base =
    CENTRO_CIDADE[key] ??
    (key.includes('foz')
      ? CENTRO_CIDADE['foz do iguacu']
      : key.includes('este') || key.includes('cde')
        ? CENTRO_CIDADE['ciudad del este']
        : key.includes('iguaz')
          ? CENTRO_CIDADE['puerto iguazu']
          : null)
  if (!base) return null
  return comOffsetDeterministico(base, empresaId)
}

export type EmpresaSemCoords = {
  id: string
  endereco?: string | null
  bairro?: string | null
  cidade?: string | null
}

/**
 * Geocodifica e persiste lat/lng para empresas regulares sem coordenada.
 * Limitado por request para não estourar timeout (Mapbox + UPDATE).
 */
export async function backfillCoordsEmpresas(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient | any,
  empresas: EmpresaSemCoords[],
  opts?: { maxPorRequest?: number },
): Promise<Map<string, GeoPoint>> {
  const max = Math.max(1, opts?.maxPorRequest ?? 20)
  const preenchidos = new Map<string, GeoPoint>()
  const fila = empresas.filter((e) => e?.id).slice(0, max)

  await Promise.all(
    fila.map(async (emp) => {
      const id = String(emp.id)
      const query = montarQueryEnderecoEmpresa({
        endereco: emp.endereco,
        bairro: emp.bairro,
        cidade: emp.cidade,
      })

      let geo: GeoPoint | null = null
      if (query.length >= 5) {
        geo = await forwardGeocodeMapbox(query)
      }
      if (!geo && emp.cidade) {
        const soCidade = String(emp.cidade).trim()
        if (soCidade.length >= 5) {
          geo = await forwardGeocodeMapbox(soCidade)
        }
      }
      if (!geo) {
        geo = fallbackCentroCidade(String(emp.cidade ?? ''), id)
      }
      if (!geo) return

      const { error } = await supabase
        .from('empresas')
        .update({ latitude: geo.lat, longitude: geo.lng })
        .eq('id', id)

      if (!error) {
        preenchidos.set(id, geo)
      }
    }),
  )

  return preenchidos
}
