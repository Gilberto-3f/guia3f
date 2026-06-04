'use client'

import { ShieldCheck } from 'lucide-react'

/**
 * Escudo de verificação do profissional (sem bolha de fundo).
 * Pendente: vermelho com "?". Verificado: verde sólido, mesmo formato do pendente.
 * @param {{ className?: string, iconSize?: number, title?: string, verificado?: boolean }} props
 */
export default function EscudoVerificacaoPendente({
  className = 'h-7 w-7',
  iconSize = 22,
  title,
  verificado = false,
}) {
  const titulo = title ?? (verificado ? 'Profissional verificado' : 'Perfil em análise')

  if (verificado) {
    return (
      <span className={`relative inline-flex shrink-0 items-center justify-center ${className}`} title={titulo}>
        <ShieldCheck
          size={iconSize}
          className="text-[#00D443]"
          fill="currentColor"
          stroke="white"
          strokeWidth={2}
          aria-hidden
        />
      </span>
    )
  }

  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center ${className}`} title={titulo}>
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
