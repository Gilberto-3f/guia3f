const KEY = 'guia3f.canaisEcossistemaId'

export const ECOSSISTEMA_CANAIS_ADM_EVENT = 'guia-canais-ecossistema'

export function lerEcossistemaCanaisAdmId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(KEY)
    return v && v.trim() ? v.trim() : null
  } catch {
    return null
  }
}

export function gravarEcossistemaCanaisAdmId(id: string) {
  if (typeof window === 'undefined') return
  const v = String(id ?? '').trim()
  if (!v) return
  try {
    window.localStorage.setItem(KEY, v)
    window.dispatchEvent(new CustomEvent(ECOSSISTEMA_CANAIS_ADM_EVENT, { detail: { id: v } }))
  } catch {
    /* storage bloqueado */
  }
}
