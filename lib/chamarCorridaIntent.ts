/** Intent do botão Chamar corrida — fonte da verdade entre páginas (evita destino stale). */

const STORAGE_KEY = 'guia_chamar_corrida_intent'

export type ChamarCorridaIntent = {
  empresaId: string
  nomeDestino: string
  lat: number | null
  lng: number | null
  ts: number
}

export function salvarChamarCorridaIntent(input: {
  empresaId: string
  nomeDestino?: string | null
  lat?: number | null
  lng?: number | null
}) {
  if (typeof window === 'undefined') return
  const empresaId = String(input.empresaId ?? '').trim()
  if (!empresaId) return
  const payload: ChamarCorridaIntent = {
    empresaId,
    nomeDestino: String(input.nomeDestino ?? '').trim(),
    lat: input.lat != null && Number.isFinite(input.lat) ? input.lat : null,
    lng: input.lng != null && Number.isFinite(input.lng) ? input.lng : null,
    ts: Date.now(),
  }
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* private mode / quota */
  }
}

export function consumirChamarCorridaIntent(): ChamarCorridaIntent | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    sessionStorage.removeItem(STORAGE_KEY)
    const parsed = JSON.parse(raw) as ChamarCorridaIntent
    if (!parsed?.empresaId) return null
    return parsed
  } catch {
    return null
  }
}

export function limparChamarCorridaIntent() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
