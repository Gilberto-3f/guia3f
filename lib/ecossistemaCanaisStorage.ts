import { GUIA_CANAIS_BADGE_EVENT } from '@/lib/canais-badge-events'

const KEY = 'guia3f.ecossistemaCanaisId'

export const ECOSSISTEMA_CANAIS_EVENT = 'guia-ecossistema-canais'

export function lerEcossistemaCanaisId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(KEY)
    return v && v.trim() ? v.trim() : null
  } catch {
    return null
  }
}

export function gravarEcossistemaCanaisId(id: string) {
  if (typeof window === 'undefined') return
  const v = String(id ?? '').trim()
  if (!v) return
  try {
    window.localStorage.setItem(KEY, v)
    window.dispatchEvent(new CustomEvent(ECOSSISTEMA_CANAIS_EVENT, { detail: { id: v } }))
    window.dispatchEvent(new Event(GUIA_CANAIS_BADGE_EVENT))
  } catch {
    /* storage bloqueado */
  }
}
