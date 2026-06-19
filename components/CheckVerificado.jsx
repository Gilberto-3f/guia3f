'use client'

import { BadgeCheck } from 'lucide-react'

/** Tamanho padrão do selo em todo o app (referência: dashboard empresa). */
export const CLASSE_CHECK_VERIFICADO_PADRAO = 'h-4 w-4 shrink-0'

/**
 * Selo de conta verificada (documentação em ordem).
 * @param {{ className?: string, title?: string, variant?: 'profissional' | 'empresa' }} props
 */
export default function CheckVerificado({
  className = CLASSE_CHECK_VERIFICADO_PADRAO,
  title = 'Conta verificada',
  variant = 'profissional',
}) {
  const cor = variant === 'empresa' ? 'text-[#0097b2]' : 'text-[#00D443]'

  return (
    <BadgeCheck
      className={`${cor} ${className}`}
      fill="currentColor"
      stroke="white"
      strokeWidth={2}
      aria-hidden
      title={title}
    />
  )
}
