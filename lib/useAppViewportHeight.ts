'use client'

import { useEffect } from 'react'

/**
 * Define --app-height com window.innerHeight.
 * No iOS, 100dvh / fixed inset-0 costumam ficar mais curtos que a tela
 * e geram faixa vazia sob BottomBar e drawers.
 */
export function useAppViewportHeight() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const sync = () => {
      const vv = window.visualViewport
      const fromVv =
        vv != null ? Math.round(vv.height + vv.offsetTop) : 0
      const h = Math.max(
        Math.round(window.innerHeight),
        Math.round(document.documentElement.clientHeight || 0),
        fromVv,
      )
      if (h > 0) {
        document.documentElement.style.setProperty('--app-height', `${h}px`)
      }
    }

    sync()
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)
    window.visualViewport?.addEventListener('resize', sync)
    window.visualViewport?.addEventListener('scroll', sync)

    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
      window.visualViewport?.removeEventListener('resize', sync)
      window.visualViewport?.removeEventListener('scroll', sync)
    }
  }, [])
}
