'use client'

import { useEffect } from 'react'

/** Bloqueia scroll do `document` enquanto um modal está aberto (restaura ao fechar). */
export function useModalScrollLock(aberto: boolean) {
  useEffect(() => {
    if (!aberto) return
    const prevBody = document.body.style.overflow
    const prevHtml = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevBody
      document.documentElement.style.overflow = prevHtml
    }
  }, [aberto])
}
