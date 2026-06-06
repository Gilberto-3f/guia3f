'use client'

import type { ReactNode } from 'react'

interface Props {
  subtitulo: string
  children: ReactNode
}

export default function RelatorioDetalhado({ subtitulo, children }: Props) {
  return (
    <div className="mx-auto max-w-xl rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col items-center gap-0.5">
        <h3 className="text-center text-base font-bold text-[#001f3f] sm:text-lg">Relatório Detalhado</h3>
        <p className="text-center text-sm leading-tight text-gray-600">{subtitulo}</p>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  )
}
