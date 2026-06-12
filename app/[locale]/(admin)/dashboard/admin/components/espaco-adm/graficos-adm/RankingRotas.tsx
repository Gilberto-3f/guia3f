'use client'

import type { Rota } from '../../../hooks/useGraficosAdm'

export default function RankingRotas({ rotas }: { rotas: Rota[] }) {
  if (rotas.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-gray-500">
        Nenhuma rota registrada no período selecionado.
      </p>
    )
  }

  return (
    <ol className="mx-auto mt-2 max-w-lg space-y-2 text-center text-xs">
      {rotas.map((r, i) => (
        <li
          key={`${r.origem}-${r.destino}-${i}`}
          className="flex flex-col items-center gap-0.5 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2 sm:flex-row sm:justify-between sm:text-left"
        >
          <span className="font-medium text-gray-700">
            <span className="mr-1 font-bold text-[#0097b2]">#{i + 1}</span>
            {r.origem} → {r.destino}
          </span>
          <span className="font-bold tabular-nums text-gray-900">{r.total.toLocaleString('pt-BR')}</span>
        </li>
      ))}
    </ol>
  )
}
