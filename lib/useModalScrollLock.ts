'use client'

import { useEffect } from 'react'

/**
 * Bloqueia scroll do fundo enquanto um modal/popup está aberto (inclui iOS).
 * Restaura posição de scroll ao fechar.
 */
export function useModalScrollLock(aberto: boolean) {
  useEffect(() => {
    if (!aberto || typeof document === 'undefined') return

    const html = document.documentElement
    const body = document.body
    const scrollY = window.scrollY

    const prevHtmlOverflow = html.style.overflow
    const prevBodyOverflow = body.style.overflow
    const prevBodyPosition = body.style.position
    const prevBodyTop = body.style.top
    const prevBodyWidth = body.style.width
    const prevBodyTouchAction = body.style.touchAction

    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'
    body.style.touchAction = 'none'

    const blockTouchMove = (e: TouchEvent) => {
      const target = e.target
      if (!(target instanceof Element)) {
        e.preventDefault()
        return
      }
      if (target.closest('[data-modal-scroll-lock-scrollable]')) return
      e.preventDefault()
    }

    document.addEventListener('touchmove', blockTouchMove, { passive: false })

    return () => {
      document.removeEventListener('touchmove', blockTouchMove)
      html.style.overflow = prevHtmlOverflow
      body.style.overflow = prevBodyOverflow
      body.style.position = prevBodyPosition
      body.style.top = prevBodyTop
      body.style.width = prevBodyWidth
      body.style.touchAction = prevBodyTouchAction
      window.scrollTo(0, scrollY)
    }
  }, [aberto])
}
