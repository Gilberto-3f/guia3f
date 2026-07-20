'use client'

import { ChevronDown, Info, type LucideIcon } from 'lucide-react'

type Props = {
  titulo: string
  aberto: boolean
  onToggle: () => void
  children: React.ReactNode
  icone?: LucideIcon
  corTitulo?: string
  /** Ícone de informação ao lado do título (não abre/fecha a pasta). */
  onInfo?: () => void
  infoAriaLabel?: string
}

export default function ChevronPasta({
  titulo,
  aberto,
  onToggle,
  children,
  icone: Icone,
  corTitulo = '#001f3f',
  onInfo,
  infoAriaLabel = 'Informações',
}: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-[#f5f5f5]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={aberto}
      >
        <span className="flex min-w-0 items-center gap-2">
          {Icone ? (
            <Icone className="h-5 w-5 shrink-0" style={{ color: corTitulo }} strokeWidth={2.25} aria-hidden />
          ) : null}
          <span className="text-sm font-bold" style={{ color: corTitulo }}>
            {titulo}
          </span>
          {onInfo ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onInfo()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.stopPropagation()
                  onInfo()
                }
              }}
              className="inline-flex shrink-0 rounded-full p-0.5 text-gray-400 hover:bg-black/5 hover:text-gray-600"
              aria-label={infoAriaLabel}
            >
              <Info className="h-4 w-4" strokeWidth={2.25} aria-hidden />
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${aberto ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {aberto ? <div className="border-t border-gray-200 bg-white px-4 py-3">{children}</div> : null}
    </div>
  )
}
