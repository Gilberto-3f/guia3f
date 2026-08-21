/** Rota Mapbox Directions (ruas) — corrida ativa. */

export type PontoLatLng = { lat: number; lng: number }

export type RotaDirectionsMobilidade = {
  coordinates: [number, number][]
  durationSec: number | null
  distanceM: number | null
}

function mapboxToken(): string {
  return typeof process !== 'undefined' ? String(process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '').trim() : ''
}

function roundKey(n: number, digits: number): string {
  const f = 10 ** digits
  return String(Math.round(n * f) / f)
}

export function chaveRotaDirections(de: PontoLatLng, ate: PontoLatLng): string {
  return `${roundKey(de.lat, 3)},${roundKey(de.lng, 3)}>${roundKey(ate.lat, 3)},${roundKey(ate.lng, 3)}`
}

const cache = new Map<string, RotaDirectionsMobilidade>()

/** Texto curto de duração (ETA no drawer). */
export function formatarDuracaoEta(sec: number): string {
  const min = Math.max(1, Math.round(sec / 60))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

export function peekRotaDirectionsCache(
  de: PontoLatLng,
  ate: PontoLatLng,
): RotaDirectionsMobilidade | null {
  return cache.get(chaveRotaDirections(de, ate)) ?? null
}

function linhaReta(de: PontoLatLng, ate: PontoLatLng): RotaDirectionsMobilidade {
  return {
    coordinates: [
      [de.lng, de.lat],
      [ate.lng, ate.lat],
    ],
    durationSec: null,
    distanceM: null,
  }
}

/**
 * Percurso de carro pelas ruas (ponte / avenidas).
 * Cache ~100 m para não repetir a API a cada tick de GPS.
 */
export async function buscarRotaMapboxDriving(
  de: PontoLatLng,
  ate: PontoLatLng,
): Promise<RotaDirectionsMobilidade | null> {
  if (
    !Number.isFinite(de.lat) ||
    !Number.isFinite(de.lng) ||
    !Number.isFinite(ate.lat) ||
    !Number.isFinite(ate.lng)
  ) {
    return null
  }

  const key = chaveRotaDirections(de, ate)
  const hit = cache.get(key)
  if (hit) return hit

  const token = mapboxToken()
  if (!token) {
    const fallback = linhaReta(de, ate)
    cache.set(key, fallback)
    return fallback
  }

  try {
    const url = new URL(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${de.lng},${de.lat};${ate.lng},${ate.lat}`,
    )
    url.searchParams.set('access_token', token)
    url.searchParams.set('geometries', 'geojson')
    url.searchParams.set('overview', 'full')
    url.searchParams.set('language', 'pt')

    const res = await fetch(url.toString())
    if (!res.ok) {
      const fallback = linhaReta(de, ate)
      cache.set(key, fallback)
      return fallback
    }
    const json = (await res.json()) as {
      routes?: Array<{
        duration?: number
        distance?: number
        geometry?: { coordinates?: [number, number][] }
      }>
    }
    const route = json.routes?.[0]
    const coords = route?.geometry?.coordinates
    if (!Array.isArray(coords) || coords.length < 2) {
      const fallback = linhaReta(de, ate)
      cache.set(key, fallback)
      return fallback
    }

    const out: RotaDirectionsMobilidade = {
      coordinates: coords.filter(
        (c) => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]),
      ),
      durationSec:
        route?.duration != null && Number.isFinite(Number(route.duration))
          ? Number(route.duration)
          : null,
      distanceM:
        route?.distance != null && Number.isFinite(Number(route.distance))
          ? Number(route.distance)
          : null,
    }
    if (out.coordinates.length < 2) {
      const fallback = linhaReta(de, ate)
      cache.set(key, fallback)
      return fallback
    }
    cache.set(key, out)
    return out
  } catch {
    const fallback = linhaReta(de, ate)
    cache.set(key, fallback)
    return fallback
  }
}
