/** Reverse geocode Mapbox → rua, nº, bairro e cidade (abreviado). */

function textoCtx(
  context: Array<{ id?: string; text?: string }> | undefined,
  prefix: string,
): string {
  if (!context?.length) return ''
  const hit = context.find((c) => String(c.id ?? '').startsWith(prefix))
  return String(hit?.text ?? '').trim()
}

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

    const rua = String(f.text ?? '').trim()
    const numero = String(f.address ?? '').trim()
    const bairro =
      textoCtx(f.context, 'neighborhood') || textoCtx(f.context, 'locality')
    const cidade =
      textoCtx(f.context, 'place') ||
      textoCtx(f.context, 'locality') ||
      textoCtx(f.context, 'district')

    const partes: string[] = []
    if (rua && numero) partes.push(`${rua}, ${numero}`)
    else if (rua) partes.push(rua)
    if (bairro && bairro !== cidade) partes.push(bairro)
    if (cidade) partes.push(cidade)

    if (partes.length > 0) {
      const joined = partes.join(' · ')
      return joined.length > 72 ? `${joined.slice(0, 69)}…` : joined
    }

    const place = String(f.place_name ?? '').trim()
    if (place) {
      const parts = place.split(',').map((p) => p.trim()).filter(Boolean)
      if (parts.length > 3) return parts.slice(0, 3).join(', ')
      return place
    }

    return null
  } catch {
    return null
  }
}
