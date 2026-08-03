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
  soft: boolean
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

/** Guia/Mobilidade já usam h-dvh + overflow hidden — position:fixed no body cria faixa sob a barra. */
function usarLockSuave(): boolean {
  if (typeof window === 'undefined') return false
  const p = window.location.pathname
  return /\/guia\/?$/.test(p) || p.includes('/mobilidade')
}

/**
 * Bloqueia scroll do fundo enquanto um modal/popup está aberto (inclui iOS).
 * Suporta múltiplos modais em paralelo; só libera o scroll ao fechar o último.
 * Em Guia/Mobilidade: lock "suave" (sem position:fixed) para não gerar espaço extra sob a UI.
 */
export function useModalScrollLock(aberto: boolean) {
  useEffect(() => {
    if (!aberto || typeof document === 'undefined') return

    const html = document.documentElement
    const body = document.body
    const soft = usarLockSuave()

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
        soft,
      }

      html.style.overflow = 'hidden'
      body.style.overflow = 'hidden'
      body.style.touchAction = 'none'

      if (!soft) {
        body.style.position = 'fixed'
        body.style.top = `-${scrollY}px`
        body.style.width = '100%'
      }

      document.addEventListener('touchmove', blockTouchMove, { passive: false })
    }

    activeLocks += 1

    return () => {
      activeLocks = Math.max(0, activeLocks - 1)
      if (activeLocks > 0 || !snapshot) return

      document.removeEventListener('touchmove', blockTouchMove)

      const snap = snapshot
      snapshot = null

      html.style.overflow = snap.htmlOverflow
      body.style.overflow = snap.bodyOverflow
      body.style.touchAction = snap.bodyTouchAction

      if (!snap.soft) {
        body.style.position = snap.bodyPosition
        body.style.top = snap.bodyTop
        body.style.width = snap.bodyWidth
        window.scrollTo(0, snap.scrollY)
      } else {
        // Garante limpeza residual de locks antigos (position:fixed).
        if (body.style.position === 'fixed') {
          body.style.position = ''
          body.style.top = ''
          body.style.width = ''
        }
        window.scrollTo(0, 0)
      }
    }
  }, [aberto])
}
