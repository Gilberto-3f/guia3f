'use client'

import { Menu } from 'lucide-react'

type BotaoAbrirMenuLateralProps = {
  onClick: () => void
  className?: string
  iconClassName?: string
}

/** Abre o menu lateral do perfil/empresa — não confundir com o ícone Menu da BottomBar (navega para o feed). */
export default function BotaoAbrirMenuLateral({
  onClick,
  className = 'flex shrink-0 items-center p-1 text-[#0097b2]',
  iconClassName = 'h-6 w-6',
}: BotaoAbrirMenuLateralProps) {
  return (
    <button type="button" onClick={onClick} className={className} aria-label="Abrir menu lateral">
      <Menu className={iconClassName} strokeWidth={2.25} aria-hidden />
    </button>
  )
}
