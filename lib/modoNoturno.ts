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

const COR_FEED = '#ffffff'
const COR_DIA = '#0097b2'
const COR_NOITE = '#000000'

function feedStatusBrancoAtivo(): boolean {
  return document.documentElement.classList.contains('feed-status-branco')
}

/** Pinta html, a faixa da status bar e o theme-color. No feed a faixa fica branca. */
function pintarChromeStatus(cor: string): void {
  const root = document.documentElement
  root.style.background = cor
  if (document.body) document.body.style.background = cor
  document.querySelectorAll('.app-status-cap').forEach((el) => {
    if (el instanceof HTMLElement) el.style.setProperty('background-color', cor, 'important')
  })
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute('content', cor)
  })
}

/** Aplica/remove classe `dark` no <html> (fonte da verdade visual). */
export function aplicarClasseModoNoturno(ativo: boolean): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (ativo) {
    root.classList.add('dark')
    root.style.colorScheme = 'dark'
  } else {
    root.classList.remove('dark')
    root.style.colorScheme = 'light'
  }
  const cor = feedStatusBrancoAtivo() ? COR_FEED : ativo ? COR_NOITE : COR_DIA
  try {
    pintarChromeStatus(cor)
  } catch {
    /* ignore */
  }
}

/** Cabeçalho branco só na página do feed. As demais páginas seguem o azul (ou preto no noturno). */
export function definirStatusFeedBranco(ativo: boolean): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle('feed-status-branco', ativo)
  const pintar = () => {
    if (document.documentElement.classList.contains('feed-status-branco') !== ativo) return
    aplicarClasseModoNoturno(lerModoNoturnoStorage())
  }
  pintar()
  // O modo claro reaplica o azul no efeito seguinte; pinta de novo depois disso.
  requestAnimationFrame(pintar)
}

/** Script inline (antes do paint) — evita flash branco ao reabrir o app. No /feed o topo já nasce branco. */
export const MODO_NOTURNO_BOOT_SCRIPT = `(function(){try{var k=${JSON.stringify(MODO_NOTURNO_STORAGE_KEY)};var v=localStorage.getItem(k);var r=document.documentElement;var feed=/\\/feed\\/?$/.test(location.pathname||'');var noite=v==='1'||v==='true';if(feed)r.classList.add('feed-status-branco');if(noite){r.classList.add('dark');r.style.colorScheme='dark';}else{r.classList.remove('dark');}r.style.background=feed?'#ffffff':(noite?'#000000':'#0097b2');}catch(e){}})();`
