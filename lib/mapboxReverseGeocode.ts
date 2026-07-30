/** Reverse geocode Mapbox → endereço curto para o ponto de partida. */

export async function reverseGeocodeMapbox(
  lat: number,
  lng: number,
): Promise<string | null> {
  const token =
    typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() : ''
  if (!token || !Number.isFinite(lat) || !Number.isFinite(lng)) return null

  try {
    const url = new URL(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json`,
    )
    url.searchParams.set('access_token', token)
    url.searchParams.set('language', 'pt')
    url.searchParams.set('limit', '1')
    url.searchParams.set('types', 'address,poi,place,locality,neighborhood')

    const res = await fetch(url.toString())
    if (!res.ok) return null
    const json = (await res.json()) as {
      features?: Array<{
        place_name?: string
        text?: string
        address?: string
        context?: Array<{ id?: string; text?: string }>
      }>
    }
    const f = json.features?.[0]
    if (!f) return null

    const place = String(f.place_name ?? '').trim()
    if (place) {
      // Encurta: remove país no final se houver vírgulas demais
      const parts = place.split(',').map((p) => p.trim()).filter(Boolean)
      if (parts.length > 3) return parts.slice(0, 3).join(', ')
      return place
    }

    const text = String(f.text ?? '').trim()
    const addr = String(f.address ?? '').trim()
    if (text && addr) return `${text}, ${addr}`
    return text || null
  } catch {
    return null
  }
}
