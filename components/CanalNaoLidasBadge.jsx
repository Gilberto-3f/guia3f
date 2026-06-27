'use client'

/**
 * Badge de não lidas nos canais.
 * @param {{ count: number, className?: string, variant?: 'vermelho' | 'segmento' }} props
 */
export default function CanalNaoLidasBadge({ count, className = '', variant = 'vermelho' }) {
  if (count <= 0) return null
  const estilo =
    variant === 'segmento'
      ? 'bg-[#00D443] text-white ring-2 ring-white'
      : 'bg-[#F44336] text-white'
  return (
    <span
      className={`inline-flex min-h-[14px] min-w-[14px] max-w-[2rem] shrink-0 items-center justify-center rounded-full px-0.5 text-[9px] font-bold leading-none tabular-nums ${estilo} ${className}`}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
