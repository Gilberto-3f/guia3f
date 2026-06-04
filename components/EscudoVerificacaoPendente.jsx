'use client'

import { ShieldCheck } from 'lucide-react'

/**
 * Escudo vermelho com "?" — paridade visual com ShieldCheck verde do perfil verificado.
 * @param {{ className?: string, iconSize?: number, title?: string }} props
 */
export default function EscudoVerificacaoPendente({
  className = 'h-7 w-7',
  iconSize = 22,
  title = 'Perfil em análise',
}) {
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center ${className}`} title={title}>
      <ShieldCheck
        size={iconSize}
        className="text-[#F44336]"
        fill="currentColor"
        stroke="#F44336"
        strokeWidth={1.5}
        aria-hidden
      />
      <span className="absolute inset-0 flex items-center justify-center pb-px text-[11px] font-bold leading-none text-white">
        ?
      </span>
    </span>
  )
}
