'use client'

import { Menu, MoreVertical } from 'lucide-react'

type BotaoAbrirMenuLateralProps = {
  onClick: () => void
  className?: string
  iconClassName?: string
}

export default function BotaoAbrirMenuLateral({
  onClick,
  className = 'flex shrink-0 items-center gap-0.5 px-1 text-[#0097b2]',
  iconClassName = 'h-6 w-6',
}: BotaoAbrirMenuLateralProps) {
  return (
    <button type="button" onClick={onClick} className={className} aria-label="Menu">
      <Menu className={iconClassName} strokeWidth={2.25} aria-hidden />
      <MoreVertical className={iconClassName} strokeWidth={2.25} aria-hidden />
    </button>
  )
}
