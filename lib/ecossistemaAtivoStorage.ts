const KEY = 'guia3f.ecossistemaId'

export const ECOSSISTEMA_ATIVO_EVENT = 'guia-ecossistema-ativo'

export function lerEcossistemaAtivoId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(KEY)
    return v && v.trim() ? v.trim() : null
  } catch {
    return null
  }
}

export function gravarEcossistemaAtivoId(id: string) {
  if (typeof window === 'undefined') return
  const v = String(id ?? '').trim()
  if (!v) return
  try {
    window.localStorage.setItem(KEY, v)
    window.dispatchEvent(new CustomEvent(ECOSSISTEMA_ATIVO_EVENT, { detail: { id: v } }))
  } catch {
    /* storage bloqueado */
  }
}
