'use client'

import { useEffect } from 'react'

function syncAppHeight() {
  if (typeof window === 'undefined') return
  const vv = window.visualViewport
  const fromVv = vv != null ? Math.round(vv.height + vv.offsetTop) : 0
  const h = Math.max(
    Math.round(window.innerHeight),
    Math.round(document.documentElement.clientHeight || 0),
    fromVv,
  )
  if (h > 0) {
    document.documentElement.style.setProperty('--app-height', `${h}px`)
  }
}

/**
 * Define --app-height com a altura real da janela.
 * No iOS, 100dvh costuma ficar mais curto e gera faixa sob drawers/BottomBar.
 */
export function useAppViewportHeight() {
  useEffect(() => {
    syncAppHeight()
    window.addEventListener('resize', syncAppHeight)
    window.addEventListener('orientationchange', syncAppHeight)
    window.visualViewport?.addEventListener('resize', syncAppHeight)
    window.visualViewport?.addEventListener('scroll', syncAppHeight)

    return () => {
      window.removeEventListener('resize', syncAppHeight)
      window.removeEventListener('orientationchange', syncAppHeight)
      window.visualViewport?.removeEventListener('resize', syncAppHeight)
      window.visualViewport?.removeEventListener('scroll', syncAppHeight)
    }
  }, [])
}

/** Chamar ao abrir um drawer full-screen (garante altura atualizada). */
export function refreshAppViewportHeight() {
  syncAppHeight()
}
