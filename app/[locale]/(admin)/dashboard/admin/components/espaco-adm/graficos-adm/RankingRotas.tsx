'use client'

import type { Rota } from '../../../hooks/useGraficosAdm'

export default function RankingRotas({ rotas }: { rotas: Rota[] }) {
  if (rotas.length === 0) {
    return <div className="mt-4 text-xs text-gray-500">Nenhuma rota registrada no período.</div>
  }

  return (
    <ol className="mt-3 space-y-1 text-xs">
      {rotas.map((r, i) => (
        <li key={`${r.origem}-${r.destino}-${i}`} className="flex items-center justify-between">
          <span className="text-gray-700">
            #{i + 1} {r.origem} → {r.destino}
          </span>
          <span className="font-semibold text-gray-900">{r.total}</span>
        </li>
      ))}
    </ol>
  )
}

