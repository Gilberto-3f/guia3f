'use client'

import { ChevronDown, ChevronUp, type LucideIcon } from 'lucide-react'
import CanalNaoLidasBadge from '@/components/CanalNaoLidasBadge'

/** Distância segura da borda direita para o badge ficar dentro do clip-path do funil. */
function calcBadgeRightPct(indiceEtapa: number, totalEtapas: number): number {
  if (totalEtapas <= 0) return 3
  const topoY = indiceEtapa / totalEtapas
  const bordaDireitaPct = 100 - 28 * topoY
  return Math.max(3, 100 - bordaDireitaPct + 3)
}

interface Props {
  icon: LucideIcon
  label: string
  valor: number
  ocultarIcone?: boolean
  naoLidas?: number
  indiceEtapa?: number
  totalEtapas?: number
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
  naoLidas = 0,
  indiceEtapa = 0,
  totalEtapas = 1,
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

  const cls = `${bg} relative w-full px-4 py-4 text-white transition-colors duration-200 sm:px-5 sm:py-5 ${
    !isLast ? 'border-b-[3px] border-white' : ''
  }`

  const badgeRightPct = calcBadgeRightPct(indiceEtapa, totalEtapas)
  const badge =
    naoLidas > 0 ? (
      <span
        className="pointer-events-none absolute top-2 z-10 sm:top-2.5"
        style={{ right: `${badgeRightPct}%` }}
      >
        <CanalNaoLidasBadge count={naoLidas} className="!text-[10px]" />
      </span>
    ) : null

  if (expandable) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className={`${cls} hover:brightness-105`}
        aria-expanded={selected}
        aria-label={`${label}: ${valor.toLocaleString('pt-BR')}. ${selected ? 'Recolher' : 'Abrir'} Relatório Detalhado`}
      >
        {badge}
        {conteudo}
      </button>
    )
  }

  return (
    <div className={cls}>
      {badge}
      {conteudo}
    </div>
  )
}
