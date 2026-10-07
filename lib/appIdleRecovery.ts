import { resumirSessaoAposIdle } from '@/lib/authResume'
import { resetModalScrollLockStale } from '@/lib/useModalScrollLock'

/** AppShell escuta para reexibir a BottomBar (teclado/modal presos após hibernação). */
export const GUIA_IDLE_RECOVER_EVENT = 'guia-idle-recover'

const HEARTBEAT_MS = 4_000
/** JS não rodou por ~2 min → processo hibernado (PWA/Safari). */
const FREEZE_GAP_MS = 120_000
/** App em background tempo demais: o App Router RSC costuma ficar morto. */
const HIDDEN_LONG_MS = 4 * 60 * 1000
const RELOAD_GUARD_KEY = 'guia_idle_reload_at'
const RELOAD_GUARD_MS = 15_000

let lastBeat = 0
let hiddenSince = 0
let recuperando = false
let skipReload = false

export function marcarHeartbeat() {
  lastBeat = Date.now()
}

export function appFicouCongelado(): boolean {
  if (!lastBeat) return false
  return Date.now() - lastBeat > FREEZE_GAP_MS
}

/** Hibernação (JS parado) ou background longo — BottomBar deve usar navegação completa. */
export function precisaNavegacaoDura(): boolean {
  if (appFicouCongelado()) return true
  if (hiddenSince > 0 && Date.now() - hiddenSince >= HIDDEN_LONG_MS) return true
  return false
}

function jaRecarregouRecentemente(): boolean {
  try {
    const prev = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || '0')
    return Date.now() - prev < RELOAD_GUARD_MS
  } catch {
    return false
  }
}

function marcarReloadGuard() {
  try {
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()))
  } catch {
    /* ignore */
  }
}

function emitirRecoverUi() {
  try {
    window.dispatchEvent(new CustomEvent(GUIA_IDLE_RECOVER_EVENT))
  } catch {
    /* ignore */
  }
}

function limparTrapsUi() {
  emitirRecoverUi()
  try {
    resetModalScrollLockStale()
  } catch {
    /* ignore */
  }
}

function marcarFundoEncerrado() {
  hiddenSince = 0
  marcarHeartbeat()
}

/** Navegação completa — o App Router RSC fica morto após hibernação longa. */
export function navegarHard(href: string) {
  if (typeof window === 'undefined') return
  skipReload = true
  marcarReloadGuard()
  marcarFundoEncerrado()
  const path = href.startsWith('/') ? href : `/${href}`
  window.location.assign(path)
}

/**
 * Recarrega uma vez após hibernação (router cliente não consegue completar o voo RSC).
 * Ignora se já recarregou há poucos segundos (evita loop).
 */
export async function recuperarAppAposIdle(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (document.visibilityState !== 'visible') return false
  if (!precisaNavegacaoDura()) {
    marcarFundoEncerrado()
    return false
  }
  if (recuperando || jaRecarregouRecentemente()) {
    marcarFundoEncerrado()
    limparTrapsUi()
    return false
  }

  recuperando = true
  marcarReloadGuard()
  limparTrapsUi()

  try {
    await Promise.race([
      resumirSessaoAposIdle(),
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, 1200)
      }),
    ])
  } catch {
    /* ignore */
  }

  if (skipReload) return false
  window.location.reload()
  return true
}

/** Heartbeat + reload ao voltar do background / bfcache. */
export function registrarRecuperacaoIdle(): () => void {
  if (typeof window === 'undefined') return () => {}

  marcarHeartbeat()
  if (document.visibilityState === 'hidden') {
    hiddenSince = Date.now()
  }

  const beatId = window.setInterval(() => {
    // Também em background: se o timer dispara, o JS está vivo (não hibernou).
    marcarHeartbeat()
  }, HEARTBEAT_MS)

  const onVis = () => {
    if (document.visibilityState === 'hidden') {
      if (!hiddenSince) hiddenSince = Date.now()
      return
    }
    void recuperarAppAposIdle()
  }

  const onPageShow = (e: PageTransitionEvent) => {
    if (e.persisted || precisaNavegacaoDura()) {
      void recuperarAppAposIdle()
      return
    }
    marcarFundoEncerrado()
  }

  document.addEventListener('visibilitychange', onVis)
  window.addEventListener('pageshow', onPageShow)
  document.addEventListener('resume', onVis)

  return () => {
    window.clearInterval(beatId)
    document.removeEventListener('visibilitychange', onVis)
    window.removeEventListener('pageshow', onPageShow)
    document.removeEventListener('resume', onVis)
  }
}
