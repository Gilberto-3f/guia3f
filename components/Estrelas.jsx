'use client'

import { Star } from 'lucide-react'

/**
 * @param {{ nota: number, tamanho?: number, notaClassName?: string }} props
 */
export default function Estrelas({
  nota,
  tamanho = 16,
  notaClassName = 'text-xs text-gray-500',
}) {
  const n = Number(nota)
  const seguro = Number.isFinite(n) ? Math.min(5, Math.max(0, n)) : 0
  const notaArredondada = Math.round(seguro * 2) / 2
  const estrelasCheias = Math.floor(notaArredondada)
  const temMeia = notaArredondada % 1 !== 0

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => {
        if (i < estrelasCheias) {
          return <Star key={i} size={tamanho} className="fill-[#FFD700] text-[#FFD700]" aria-hidden />
        }
        if (temMeia && i === estrelasCheias) {
          return (
            <div key={i} className="relative">
              <Star size={tamanho} className="text-gray-300" aria-hidden />
              <Star
                size={tamanho}
                className="pointer-events-none absolute left-0 top-0 fill-[#FFD700] text-[#FFD700]"
                style={{ clipPath: 'inset(0 50% 0 0)' }}
                aria-hidden
              />
            </div>
          )
        }
        return <Star key={i} size={tamanho} className="text-gray-300" aria-hidden />
      })}
      <span className={`ml-1 ${notaClassName}`}>{seguro.toFixed(1)}</span>
    </div>
  )
}
