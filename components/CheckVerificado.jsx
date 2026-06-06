'use client'

import { BadgeCheck } from 'lucide-react'

/** Tamanho padrão do selo verde em todo o app (referência: dashboard empresa). */
export const CLASSE_CHECK_VERIFICADO_PADRAO = 'h-4 w-4 shrink-0'

/**
 * Selo verde de conta verificada (documentação em ordem).
 * @param {{ className?: string, title?: string }} props
 */
export default function CheckVerificado({
  className = CLASSE_CHECK_VERIFICADO_PADRAO,
  title = 'Conta verificada',
}) {
  return (
    <BadgeCheck
      className={`text-[#00D443] ${className}`}
      fill="currentColor"
      stroke="white"
      strokeWidth={2}
      aria-hidden
      title={title}
    />
  )
}
