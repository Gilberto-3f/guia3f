'use client'

import type { Tendencia } from '../../types/dashboard.types'

interface Props {
  tendencias: Tendencia[]
}

export default function TendenciasTempoReal({ tendencias }: Props) {
  if (tendencias.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-4">
        <h3 className="mb-4 font-bold text-[#001f3f]">🔥 Tendências em Tempo Real</h3>
        <div className="py-8 text-center text-gray-500">Nenhuma tendência disponível</div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="mb-4 font-bold text-[#001f3f]">🔥 Tendências em Tempo Real (últimas 24h)</h3>
      <div className="space-y-2">
        {tendencias.slice(0, 5).map((tend) => (
          <div key={tend.nome} className="flex items-center justify-between border-b border-gray-100 py-2">
            <div className="min-w-0 flex-1">
              <span className="truncate text-sm font-medium text-gray-800">{tend.nome}</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-sm text-green-600">↑ {tend.crescimento}%</span>
              <span className="text-xs text-gray-500">{tend.buscas} buscas</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

