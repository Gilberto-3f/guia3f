'use client'

import type { DadoCrescimento } from '../../types/admin.types'

export function GraficoLinha({ dados, loading, title }: { dados: DadoCrescimento[] | null; loading: boolean; title: string }) {
  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-gray-200" />
  if (!dados || dados.length === 0) return <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-500">Sem dados disponíveis</div>

  const maxTotal = Math.max(...dados.map((d) => d.total), 1)

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-4 text-sm font-bold text-gray-900">{title}</h3>
      <div className="flex h-44 items-end gap-2">
        {dados.map((item, i) => (
          <div key={`${item.mes}-${i}`} className="flex flex-1 flex-col items-center">
            <div className="w-full rounded-t bg-[#0097b2]" style={{ height: `${Math.max((item.total / maxTotal) * 100, 4)}%` }} />
            <span className="mt-2 text-[10px] text-gray-500">{item.mes}</span>
            <span className="text-[10px] font-bold text-gray-800">{item.total}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

