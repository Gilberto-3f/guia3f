/** Flag em `history.state` enquanto o menu lateral está aberto. */
export const MENU_LATERAL_HISTORY_FLAG = 'guiaMenuLateral'

/** sessionStorage: reabrir menu ao voltar (gesto back) para perfil/empresa. */
export const MENU_LATERAL_REOPEN_KEY = 'guia-reabrir-menu-lateral'

export function marcarReabrirMenuLateral() {
  try {
    sessionStorage.setItem(MENU_LATERAL_REOPEN_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function consumirReabrirMenuLateral(): boolean {
  try {
    if (sessionStorage.getItem(MENU_LATERAL_REOPEN_KEY) === '1') {
      sessionStorage.removeItem(MENU_LATERAL_REOPEN_KEY)
      return true
    }
  } catch {
    /* ignore */
  }
  return false
}

/** Remove a flag do history sem navegar (antes de ir para outra rota). */
export function limparFlagHistoryMenuLateral() {
  if (typeof window === 'undefined' || typeof history === 'undefined') return
  const st = history.state
  if (!st || typeof st !== 'object' || !(MENU_LATERAL_HISTORY_FLAG in st)) return
  const next = { ...st }
  delete next[MENU_LATERAL_HISTORY_FLAG]
  try {
    history.replaceState(next, '')
  } catch {
    /* ignore */
  }
}

export function historyTemMenuLateralAberto(): boolean {
  if (typeof window === 'undefined' || typeof history === 'undefined') return false
  const st = history.state
  return Boolean(st && typeof st === 'object' && st[MENU_LATERAL_HISTORY_FLAG] === true)
}
