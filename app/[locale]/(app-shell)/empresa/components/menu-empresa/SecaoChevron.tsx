'use client'

import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'

export default function SecaoChevron({
  titulo,
  aberta,
  onToggle,
  children,
}: {
  titulo: string
  aberta: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-bold text-gray-900 hover:bg-gray-50"
        aria-expanded={aberta}
      >
        <span>{titulo}</span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-gray-600 transition-transform ${aberta ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {aberta ? <div className="border-t border-gray-100 px-4 py-3">{children}</div> : null}
    </div>
  )
}
