'use client'

import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'

export function AdminSecaoChevron({
  titulo,
  aberta,
  onToggle,
  badge,
  children,
}: {
  titulo: string
  aberta: boolean
  onToggle: () => void
  badge?: number
  children: ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-4 py-3.5 text-left hover:bg-gray-50"
        aria-expanded={aberta}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="text-sm font-bold text-gray-900">{titulo}</span>
          {badge != null && badge > 0 ? (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white">{badge}</span>
          ) : null}
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-gray-600 transition-transform ${aberta ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {aberta ? <div className="border-t border-gray-100 px-4 py-3">{children}</div> : null}
    </div>
  )
}
