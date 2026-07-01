/** Modo do colaborador ADM (níveis 2–3): perfil administrativo vs perfil original no app. */

export type AdminColaboradorModo = 'adm' | 'usuario'

const LS_KEY = 'guia3f_admin_colaborador_modo'

export function lerAdminColaboradorModo(): AdminColaboradorModo {
  if (typeof window === 'undefined') return 'adm'
  try {
    const v = window.localStorage.getItem(LS_KEY)
    return v === 'usuario' ? 'usuario' : 'adm'
  } catch {
    return 'adm'
  }
}

export function gravarAdminColaboradorModo(modo: AdminColaboradorModo): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_KEY, modo)
    window.dispatchEvent(new CustomEvent('admin-colaborador-modo-change', { detail: { modo } }))
  } catch {
    /* ignore */
  }
}

export function alternarAdminColaboradorModo(): AdminColaboradorModo {
  const next: AdminColaboradorModo = lerAdminColaboradorModo() === 'adm' ? 'usuario' : 'adm'
  gravarAdminColaboradorModo(next)
  return next
}

/** Níveis com pasta Admin + alternância Modo Usuário/ADM. */
export function colaboradorTemModoDual(adminLevel: number | null | undefined): boolean {
  const n = Number(adminLevel ?? 0)
  return n === 2 || n === 3
}
