'use client'

import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'

export default function SecaoChevron({
  titulo,
  aberta,
  onToggle,
  leading,
  children,
}: {
  titulo: string
  aberta: boolean
  onToggle: () => void
  /** Conteúdo à esquerda do título (ex.: ícone de informação). */
  leading?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center gap-1 px-2 py-2 sm:gap-2 sm:px-4 sm:py-3">
        {leading}
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left text-sm font-bold text-gray-900 hover:opacity-80"
          aria-expanded={aberta}
        >
          <span>{titulo}</span>
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-gray-600 transition-transform ${aberta ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
      </div>
      {aberta ? <div className="border-t border-gray-100 px-4 py-3">{children}</div> : null}
    </div>
  )
}
