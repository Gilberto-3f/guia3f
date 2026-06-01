'use client'

import { useEffect } from 'react'

/** Impede scroll do fundo enquanto modal de documentos está aberto. */
export function useBodyScrollLock(bloqueado: boolean) {
  useEffect(() => {
    if (!bloqueado || typeof document === 'undefined') return

    const scrollY = window.scrollY
    const { style } = document.body
    const prevOverflow = style.overflow
    const prevPosition = style.position
    const prevTop = style.top
    const prevWidth = style.width

    style.overflow = 'hidden'
    style.position = 'fixed'
    style.top = `-${scrollY}px`
    style.width = '100%'

    return () => {
      style.overflow = prevOverflow
      style.position = prevPosition
      style.top = prevTop
      style.width = prevWidth
      window.scrollTo(0, scrollY)
    }
  }, [bloqueado])
}
