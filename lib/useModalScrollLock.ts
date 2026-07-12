'use client'

import { useEffect } from 'react'

type ScrollLockSnapshot = {
  htmlOverflow: string
  bodyOverflow: string
  bodyPosition: string
  bodyTop: string
  bodyWidth: string
  bodyTouchAction: string
  scrollY: number
}

let activeLocks = 0
let snapshot: ScrollLockSnapshot | null = null

/** True enquanto ao menos um modal/popup com scroll lock está aberto. */
export function isModalScrollLocked() {
  return activeLocks > 0
}

const blockTouchMove = (e: TouchEvent) => {
  const target = e.target
  if (!(target instanceof Element)) {
    e.preventDefault()
    return
  }
  if (target.closest('[data-modal-scroll-lock-scrollable]')) return
  e.preventDefault()
}

/**
 * Bloqueia scroll do fundo enquanto um modal/popup está aberto (inclui iOS).
 * Suporta múltiplos modais em paralelo; só libera o scroll ao fechar o último.
 */
export function useModalScrollLock(aberto: boolean) {
  useEffect(() => {
    if (!aberto || typeof document === 'undefined') return

    const html = document.documentElement
    const body = document.body

    if (activeLocks === 0) {
      const scrollY = window.scrollY
      snapshot = {
        htmlOverflow: html.style.overflow,
        bodyOverflow: body.style.overflow,
        bodyPosition: body.style.position,
        bodyTop: body.style.top,
        bodyWidth: body.style.width,
        bodyTouchAction: body.style.touchAction,
        scrollY,
      }

      html.style.overflow = 'hidden'
      body.style.overflow = 'hidden'
      body.style.position = 'fixed'
      body.style.top = `-${scrollY}px`
      body.style.width = '100%'
      body.style.touchAction = 'none'

      document.addEventListener('touchmove', blockTouchMove, { passive: false })
    }

    activeLocks += 1

    return () => {
      activeLocks = Math.max(0, activeLocks - 1)
      if (activeLocks > 0 || !snapshot) return

      document.removeEventListener('touchmove', blockTouchMove)

      html.style.overflow = snapshot.htmlOverflow
      body.style.overflow = snapshot.bodyOverflow
      body.style.position = snapshot.bodyPosition
      body.style.top = snapshot.bodyTop
      body.style.width = snapshot.bodyWidth
      body.style.touchAction = snapshot.bodyTouchAction
      window.scrollTo(0, snapshot.scrollY)

      snapshot = null
    }
  }, [aberto])
}
