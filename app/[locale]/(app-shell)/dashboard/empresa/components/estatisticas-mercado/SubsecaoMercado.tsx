'use client'

import type { ReactNode } from 'react'

interface Props {
  titulo: string
  children: ReactNode
}

export default function SubsecaoMercado({ titulo, children }: Props) {
  return (
    <div className="space-y-2 border-b border-gray-200/80 pb-5 last:border-b-0 last:pb-0">
      <h4 className="text-sm font-semibold text-gray-800">{titulo}</h4>
      {children}
    </div>
  )
}
