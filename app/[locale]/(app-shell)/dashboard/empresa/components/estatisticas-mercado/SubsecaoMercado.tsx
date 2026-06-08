'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

interface Props {
  id: string
  titulo: string
  subtitulo?: string
  children: ReactNode
}

export default function SubsecaoMercado({ id, titulo, subtitulo, children }: Props) {
  const [aberto, setAberto] = useState(false)

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200/90 bg-white shadow-sm">
      <button
        type="button"
        id={`subsecao-${id}`}
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-gray-50/80 sm:px-4"
        aria-expanded={aberto}
      >
        <span className="min-w-0 flex-1 text-sm font-bold uppercase tracking-wide text-[#001f3f] sm:text-base">
          {titulo}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#0097b2] transition-transform duration-200 sm:h-5 sm:w-5 ${aberto ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {aberto ? (
        <div className="space-y-3 border-t border-gray-100 bg-gray-50/40 px-3 pb-4 pt-3 sm:px-4">
          {subtitulo ? (
            <p className="text-center text-xs text-gray-500 sm:text-sm">{subtitulo}</p>
          ) : null}
          {children}
        </div>
      ) : null}
    </div>
  )
}
