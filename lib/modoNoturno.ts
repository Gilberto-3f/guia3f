/** Preferência de modo noturno — localStorage por aparelho (independente de sessão). */

export const MODO_NOTURNO_STORAGE_KEY = 'guia3f-modo-noturno'

export function lerModoNoturnoStorage(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const v = localStorage.getItem(MODO_NOTURNO_STORAGE_KEY)
    return v === '1' || v === 'true'
  } catch {
    return false
  }
}

export function salvarModoNoturnoStorage(ativo: boolean): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(MODO_NOTURNO_STORAGE_KEY, ativo ? '1' : '0')
  } catch {
    /* private mode */
  }
}

/** Aplica/remove classe `dark` no <html> (fonte da verdade visual). */
export function aplicarClasseModoNoturno(ativo: boolean): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (ativo) {
    root.classList.add('dark')
    root.style.colorScheme = 'dark'
    root.style.background = '#000000'
  } else {
    root.classList.remove('dark')
    root.style.colorScheme = 'light'
    root.style.background = '#ffffff'
  }
  try {
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', ativo ? '#000000' : '#0097b2')
  } catch {
    /* ignore */
  }
}

/** Script inline (antes do paint) — evita flash branco ao reabrir o app. */
export const MODO_NOTURNO_BOOT_SCRIPT = `(function(){try{var k=${JSON.stringify(MODO_NOTURNO_STORAGE_KEY)};var v=localStorage.getItem(k);if(v==='1'||v==='true'){var r=document.documentElement;r.classList.add('dark');r.style.colorScheme='dark';r.style.background='#000000';}else{document.documentElement.classList.remove('dark');}}catch(e){}})();`
