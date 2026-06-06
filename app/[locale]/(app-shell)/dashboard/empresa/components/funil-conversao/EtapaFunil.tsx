'use client'

import { ChevronDown, ChevronUp, type LucideIcon } from 'lucide-react'

interface Props {
  icon: LucideIcon
  label: string
  valor: number
  ocultarIcone?: boolean
  expandable?: boolean
  selected?: boolean
  onToggle?: () => void
  isLast?: boolean
}

export default function EtapaFunil({
  icon: Icon,
  label,
  valor,
  ocultarIcone = false,
  expandable = false,
  selected = false,
  onToggle,
  isLast = false,
}: Props) {
  const bg = selected ? 'bg-[#00D443]' : 'bg-[#0097b2]'

  const conteudo = (
    <div className="flex items-center justify-center gap-2 text-center">
      {ocultarIcone ? null : (
        <Icon className="h-5 w-5 shrink-0 sm:h-5 sm:w-5" strokeWidth={2} aria-hidden />
      )}
      <span className="text-lg font-bold tabular-nums sm:text-xl">{valor.toLocaleString('pt-BR')}</span>
      <span className="text-sm font-medium sm:text-base">{label}</span>
      {expandable ? (
        selected ? (
          <ChevronUp className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" aria-hidden />
        )
      ) : null}
    </div>
  )

  const cls = `${bg} w-full px-4 py-4 text-white transition-colors duration-200 sm:px-5 sm:py-5 ${
    !isLast ? 'border-b-[3px] border-white' : ''
  }`

  if (expandable) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className={`${cls} hover:brightness-105`}
        aria-expanded={selected}
        aria-label={`${label}: ${valor.toLocaleString('pt-BR')}. ${selected ? 'Recolher' : 'Abrir'} Relatório Detalhado`}
      >
        {conteudo}
      </button>
    )
  }

  return <div className={cls}>{conteudo}</div>
}
