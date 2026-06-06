'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown, type LucideIcon } from 'lucide-react'

interface Props {
  id: string
  titulo: string
  icon: LucideIcon
  children: ReactNode
  aberto?: boolean
  onToggle?: () => void
  /** Modo controlado externamente (accordion único). */
  controlado?: boolean
}

export default function PastaEstatistica({
  id,
  titulo,
  icon: Icon,
  children,
  aberto: abertoProp,
  onToggle,
  controlado = false,
}: Props) {
  const [abertoLocal, setAbertoLocal] = useState(false)
  const aberto = controlado ? Boolean(abertoProp) : abertoLocal

  const toggle = () => {
    if (controlado) {
      onToggle?.()
    } else {
      setAbertoLocal((v) => !v)
    }
  }

  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm" aria-labelledby={`pasta-${id}`}>
      <button
        type="button"
        id={`pasta-${id}`}
        onClick={toggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50/80"
        aria-expanded={aberto}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0097b2]/10">
            <Icon className="h-5 w-5 text-[#0097b2]" strokeWidth={2} aria-hidden />
          </span>
          <span className="text-sm font-bold uppercase tracking-wide text-[#0097b2] sm:text-base">{titulo}</span>
        </div>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-[#0097b2] transition-transform duration-200 ${aberto ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {aberto ? (
        <div className="border-t border-gray-100 bg-gray-50/60 px-4 pb-4 pt-3">{children}</div>
      ) : null}
    </section>
  )
}
