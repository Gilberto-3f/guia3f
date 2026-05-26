'use client'

/**
 * Badge vermelho de não lidas (mesmo estilo da BottomBar).
 * @param {{ count: number, className?: string }} props
 */
export default function CanalNaoLidasBadge({ count, className = '' }) {
  if (count <= 0) return null
  return (
    <span
      className={`inline-flex min-h-[14px] min-w-[14px] max-w-[2rem] shrink-0 items-center justify-center rounded-full bg-[#F44336] px-0.5 text-[9px] font-bold leading-none text-white tabular-nums ${className}`}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
