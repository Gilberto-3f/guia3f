'use client'

import { ChevronDown, ChevronUp, type LucideIcon } from 'lucide-react'

interface Props {
  icon: LucideIcon
  label: string
  valor: number
  widthPercent: number
  expandable?: boolean
  selected?: boolean
  onToggle?: () => void
}

export default function EtapaFunil({
  icon: Icon,
  label,
  valor,
  widthPercent,
  expandable = false,
  selected = false,
  onToggle,
}: Props) {
  const bg = selected ? 'bg-[#00D443]' : 'bg-[#0097b2]'

  return (
    <div className="mx-auto w-full transition-[max-width] duration-200" style={{ maxWidth: `${widthPercent}%` }}>
      <div
        className={`relative ${bg} px-4 py-5 text-white shadow-md transition-colors duration-200`}
        style={{
          clipPath: 'polygon(6% 0%, 94% 0%, 100% 100%, 0% 100%)',
        }}
      >
        <div className="flex flex-col items-center justify-center gap-1 text-center">
          <div className="flex items-center justify-center gap-2">
            <Icon className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
            <span className="text-sm font-semibold uppercase tracking-wide sm:text-base">{label}</span>
          </div>
          <p className="text-2xl font-bold sm:text-3xl">{valor.toLocaleString('pt-BR')}</p>
        </div>

        {expandable ? (
          <button
            type="button"
            onClick={onToggle}
            className="mt-2 flex w-full items-center justify-center gap-1 text-xs font-medium text-white/90 transition-colors hover:text-white sm:text-sm"
            aria-expanded={selected}
            aria-label={selected ? 'Recolher detalhes' : 'Ver detalhes'}
          >
            {selected ? (
              <>
                <ChevronUp className="h-4 w-4" aria-hidden />
                Ver menos
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" aria-hidden />
                Ver detalhes
              </>
            )}
          </button>
        ) : null}
      </div>
    </div>
  )
}
