'use client'

import { ChevronDown, ChevronUp, type LucideIcon } from 'lucide-react'

interface Props {
  icon: LucideIcon
  label: string
  valor: number
  expandable?: boolean
  selected?: boolean
  onToggle?: () => void
  isLast?: boolean
}

export default function EtapaFunil({
  icon: Icon,
  label,
  valor,
  expandable = false,
  selected = false,
  onToggle,
  isLast = false,
}: Props) {
  const bg = selected ? 'bg-[#00D443]' : 'bg-[#0097b2]'

  return (
    <div
      className={`${bg} px-4 py-4 text-white transition-colors duration-200 sm:px-5 sm:py-5 ${
        !isLast ? 'border-b-[3px] border-white' : ''
      }`}
    >
      <div className="flex items-center justify-center gap-2 text-center">
        <Icon className="h-5 w-5 shrink-0 sm:h-5 sm:w-5" strokeWidth={2} aria-hidden />
        <span className="text-lg font-bold tabular-nums sm:text-xl">{valor.toLocaleString('pt-BR')}</span>
        <span className="text-sm font-medium lowercase sm:text-base">{label}</span>
      </div>

      {expandable ? (
        <button
          type="button"
          onClick={onToggle}
          className="mt-2 flex w-full items-center justify-center gap-1 text-[11px] font-medium text-white/90 transition-colors hover:text-white sm:text-xs"
          aria-expanded={selected}
          aria-label={selected ? 'Recolher detalhes' : 'Ver detalhes'}
        >
          {selected ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" aria-hidden />
              Ver menos
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              Ver detalhes
            </>
          )}
        </button>
      ) : null}
    </div>
  )
}
