'use client'

import { BadgeCheck } from 'lucide-react'

/**
 * Selo verde de conta verificada (documentação em ordem).
 * @param {{ className?: string, title?: string }} props
 */
export default function CheckVerificado({ className = 'h-4 w-4 shrink-0', title = 'Conta verificada' }) {
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
