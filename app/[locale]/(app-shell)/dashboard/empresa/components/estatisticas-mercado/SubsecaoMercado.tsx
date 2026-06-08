'use client'

import type { ReactNode } from 'react'

interface Props {
  titulo: string
  subtitulo?: string
  children: ReactNode
}

export default function SubsecaoMercado({ titulo, subtitulo, children }: Props) {
  return (
    <div className="space-y-3 border-b border-gray-200/80 pb-5 last:border-b-0 last:pb-0">
      <div className="text-center">
        <h4 className="text-sm font-bold uppercase tracking-wide text-[#001f3f] sm:text-base">{titulo}</h4>
        {subtitulo ? <p className="mt-1 text-xs text-gray-500 sm:text-sm">{subtitulo}</p> : null}
      </div>
      {children}
    </div>
  )
}
