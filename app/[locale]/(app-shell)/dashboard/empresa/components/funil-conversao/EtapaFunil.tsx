'use client'

import { ChevronDown, ChevronUp, type LucideIcon } from 'lucide-react'
import CanalNaoLidasBadge from '@/components/CanalNaoLidasBadge'

interface Props {
  icon: LucideIcon
  label: string
  valor: number
  ocultarIcone?: boolean
  naoLidas?: number
  expandable?: boolean
  selected?: boolean
  onToggle?: () => void
  isLast?: boolean
  /** Layout mobile do funil ADM (chevron abaixo do texto nos blocos expansíveis). */
  variant?: 'padrao' | 'adm'
}

export default function EtapaFunil({
  icon: Icon,
  label,
  valor,
  ocultarIcone = false,
  naoLidas = 0,
  expandable = false,
  selected = false,
  onToggle,
  isLast = false,
  variant = 'padrao',
}: Props) {
  const bg = selected ? 'bg-[#00D443]' : 'bg-[#0097b2]'
  const layoutAdmMobile = variant === 'adm' && expandable

  const chevron = expandable ? (
    <div className={layoutAdmMobile ? 'flex shrink-0 flex-col items-center gap-0.5 sm:flex-row' : 'flex shrink-0 flex-col items-center gap-0.5'}>
      {selected ? (
        <ChevronUp className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" aria-hidden />
      ) : (
        <ChevronDown className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" aria-hidden />
      )}
      <CanalNaoLidasBadge count={naoLidas} className="!text-[10px]" />
    </div>
  ) : null

  const conteudo = layoutAdmMobile ? (
    <div className="flex w-full flex-col items-center gap-1 text-center sm:flex-row sm:justify-center sm:gap-2">
      <div className="flex items-center justify-center gap-2">
        {ocultarIcone ? null : (
          <Icon className="h-5 w-5 shrink-0 sm:h-5 sm:w-5" strokeWidth={2} aria-hidden />
        )}
        <span className="text-lg font-bold tabular-nums sm:text-xl">{valor.toLocaleString('pt-BR')}</span>
        <span className="text-sm font-medium sm:text-base">{label}</span>
      </div>
      {chevron}
    </div>
  ) : (
    <div className="flex items-center justify-center gap-2 text-center">
      {ocultarIcone ? null : (
        <Icon className="h-5 w-5 shrink-0 sm:h-5 sm:w-5" strokeWidth={2} aria-hidden />
      )}
      <span className="text-lg font-bold tabular-nums sm:text-xl">{valor.toLocaleString('pt-BR')}</span>
      <span className="text-sm font-medium sm:text-base">{label}</span>
      {chevron}
    </div>
  )

  const cls = `${bg} relative w-full px-4 py-4 text-white transition-colors duration-200 sm:px-5 sm:py-5 ${
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

  return (
    <div className={cls}>
      {conteudo}
    </div>
  )
}
