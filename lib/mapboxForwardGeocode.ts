/** Forward geocode Mapbox → lat/lng a partir de endereço (cidade Tríplice Fronteira). */

export type GeoPoint = { lat: number; lng: number }

function mapboxToken(): string {
  return typeof process !== 'undefined' ? String(process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '').trim() : ''
}

/** Monta query curta: rua, bairro, cidade. */
export function montarQueryEnderecoEmpresa(opts: {
  endereco?: string | null
  bairro?: string | null
  cidade?: string | null
}): string {
  const parts = [opts.endereco, opts.bairro, opts.cidade]
    .map((p) => String(p ?? '').trim())
    .filter(Boolean)
  return parts.join(', ')
}

export async function forwardGeocodeMapbox(query: string): Promise<GeoPoint | null> {
  const token = mapboxToken()
  const q = String(query ?? '').trim()
  if (!token || q.length < 5) return null

  try {
    const url = new URL(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`,
    )
    url.searchParams.set('access_token', token)
    url.searchParams.set('language', 'pt')
    url.searchParams.set('limit', '1')
    // Viés Tríplice Fronteira (Foz)
    url.searchParams.set('proximity', '-54.585,-25.516')
    url.searchParams.set('types', 'address,poi,place,locality,neighborhood')

    const res = await fetch(url.toString())
    if (!res.ok) return null
    const json = (await res.json()) as {
      features?: Array<{ center?: [number, number] }>
    }
    const center = json.features?.[0]?.center
    if (!center || center.length < 2) return null
    const lng = Number(center[0])
    const lat = Number(center[1])
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return { lat, lng }
  } catch {
    return null
  }
}
