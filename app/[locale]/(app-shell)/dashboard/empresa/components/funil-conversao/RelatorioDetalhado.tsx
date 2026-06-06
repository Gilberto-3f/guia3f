'use client'

import type { ReactNode } from 'react'

interface Props {
  subtitulo: string
  children: ReactNode
}

export default function RelatorioDetalhado({ subtitulo, children }: Props) {
  return (
    <div className="mx-auto max-w-xl rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-center text-base font-bold text-[#001f3f] sm:text-lg">Relatório detalhado</h3>
      <p className="mt-2 text-center text-sm text-gray-600">{subtitulo}</p>
      <div className="mt-4">{children}</div>
    </div>
  )
}
