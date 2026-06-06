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

/** Pirâmide invertida: topo largo, base estreita. */
const CLIP_FUNIL = 'polygon(0% 0%, 100% 0%, 92% 100%, 8% 100%)'

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
        className={`relative ${bg} px-3 py-2.5 text-white shadow-md transition-colors duration-200 sm:px-4 sm:py-3`}
        style={{ clipPath: CLIP_FUNIL }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Icon className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" strokeWidth={2} aria-hidden />
            <span className="truncate text-xs font-semibold uppercase tracking-wide sm:text-sm">{label}</span>
          </div>
          <span className="shrink-0 text-lg font-bold tabular-nums sm:text-xl">{valor.toLocaleString('pt-BR')}</span>
        </div>

        {expandable ? (
          <button
            type="button"
            onClick={onToggle}
            className="mt-1.5 flex w-full items-center justify-center gap-1 text-[11px] font-medium text-white/90 transition-colors hover:text-white sm:text-xs"
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
    </div>
  )
}
