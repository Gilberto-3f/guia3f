'use client'

import { useEffect } from 'react'

const TECLADO_PX = 120

function tecladoAberto(): boolean {
  const vv = window.visualViewport
  if (!vv) return false
  return Math.round(window.innerHeight) - Math.round(vv.height) > TECLADO_PX
}

function syncAppHeight() {
  if (typeof window === 'undefined') return
  const vv = window.visualViewport
  const inner = Math.round(window.innerHeight)
  let h = inner
  if (vv && tecladoAberto()) {
    h = Math.max(200, Math.round(vv.height + vv.offsetTop))
  }
  if (h > 0) {
    document.documentElement.style.setProperty('--app-height', `${h}px`)
  }
}

/**
 * Define --app-height com a altura real da janela.
 * Com teclado: usa visualViewport (rodapé acima do teclado).
 * Sem teclado: innerHeight (rodapé baixo, sem faixa extra).
 */
export function useAppViewportHeight() {
  useEffect(() => {
    syncAppHeight()
    window.addEventListener('resize', syncAppHeight)
    window.addEventListener('orientationchange', syncAppHeight)
    window.addEventListener('focusin', syncAppHeight)
    window.addEventListener('focusout', syncAppHeight)
    window.visualViewport?.addEventListener('resize', syncAppHeight)
    window.visualViewport?.addEventListener('scroll', syncAppHeight)

    return () => {
      window.removeEventListener('resize', syncAppHeight)
      window.removeEventListener('orientationchange', syncAppHeight)
      window.removeEventListener('focusin', syncAppHeight)
      window.removeEventListener('focusout', syncAppHeight)
      window.visualViewport?.removeEventListener('resize', syncAppHeight)
      window.visualViewport?.removeEventListener('scroll', syncAppHeight)
    }
  }, [])
}

/** Chamar ao abrir um drawer full-screen (garante altura atualizada). */
export function refreshAppViewportHeight() {
  syncAppHeight()
}
