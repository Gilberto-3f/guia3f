'use client'

import type { SegmentoAlta } from '../../types/dashboard.types'

interface Props {
  segmentos: SegmentoAlta[]
}

export default function SegmentosAlta({ segmentos }: Props) {
  const maxPercentual = Math.max(...segmentos.map((s) => s.percentual), 1)

  if (segmentos.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-4">
        <h3 className="mb-4 font-bold text-[#001f3f]">🥉 Segmentos em Alta</h3>
        <div className="py-8 text-center text-gray-500">Nenhum dado disponível</div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="mb-4 font-bold text-[#001f3f]">🥉 Segmentos em Alta</h3>
      <div className="space-y-3">
        {segmentos.map((seg) => (
          <div key={seg.segmento}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="truncate pr-2">{seg.segmento}</span>
              <span className="font-medium text-[#001f3f]">{seg.percentual.toFixed(0)}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-200">
              <div
                className="h-2 rounded-full bg-[#0097b2]"
                style={{ width: `${(seg.percentual / maxPercentual) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

