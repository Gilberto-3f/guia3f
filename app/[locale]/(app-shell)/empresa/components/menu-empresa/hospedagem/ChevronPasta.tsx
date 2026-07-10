'use client'

import { ChevronDown } from 'lucide-react'

type Props = {
  titulo: string
  aberto: boolean
  onToggle: () => void
  children: React.ReactNode
}

export default function ChevronPasta({ titulo, aberto, onToggle, children }: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-[#f5f5f5]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={aberto}
      >
        <span className="text-sm font-bold text-[#001f3f]">{titulo}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${aberto ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {aberto ? <div className="border-t border-gray-200 bg-white px-4 py-3">{children}</div> : null}
    </div>
  )
}
