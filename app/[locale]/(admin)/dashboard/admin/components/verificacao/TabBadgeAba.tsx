'use client'

import type { ReactNode } from 'react'

/** Badge posicionado na borda inferior da aba — metade dentro, metade fora do botão. */
export function TabBadgeAba({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <span className="pointer-events-none absolute bottom-0 left-1/2 z-10 -translate-x-1/2 translate-y-1/2">
      {children}
    </span>
  )
}
