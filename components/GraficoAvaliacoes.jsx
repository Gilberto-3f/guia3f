'use client'

import { Star } from 'lucide-react'

/**
 * @param {{ distribuicao: Record<number, number>, total: number, compact?: boolean }} props
 */
export default function GraficoAvaliacoes({ distribuicao, total, compact = false }) {
  const notas = [5, 4, 3, 2, 1]

  return (
    <div className={compact ? 'space-y-1' : 'space-y-2'}>
      {notas.map((nota) => {
        const quantidade = distribuicao[nota] ?? 0
        const porcentagem = total > 0 ? (quantidade / total) * 100 : 0

        return (
          <div key={nota} className={`flex items-center ${compact ? 'gap-1' : 'gap-2'}`}>
            <span
              className={`inline-flex shrink-0 items-center gap-0.5 text-gray-600 ${compact ? 'w-12 text-xs' : 'w-14 text-sm'}`}
            >
              <span>{nota}</span>
              <Star className={`shrink-0 fill-amber-400 text-amber-400 ${compact ? 'h-3 w-3' : 'h-3.5 w-3.5'}`} aria-hidden />
            </span>
            <div className={`flex-1 overflow-hidden rounded-full bg-gray-200 ${compact ? 'h-1' : 'h-2'}`}>
              <div className="h-full rounded-full bg-[#0097b2]" style={{ width: `${porcentagem}%` }} />
            </div>
            <span className={`shrink-0 text-right text-gray-500 ${compact ? 'w-6 text-xs' : 'w-10 text-xs'}`}>
              {quantidade}
            </span>
          </div>
        )
      })}
    </div>
  )
}
