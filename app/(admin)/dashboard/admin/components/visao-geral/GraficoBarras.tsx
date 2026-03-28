'use client'

import type { DadoBarras } from '../../types/admin.types'

export function GraficoBarras({
  dados,
  loading,
  title,
  emptyMessage = 'Aguardando dados. Em breve estarao disponiveis.',
}: {
  dados: DadoBarras[] | null
  loading: boolean
  title: string
  emptyMessage?: string
}) {
  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-gray-200" />
  if (!dados || dados.length === 0 || dados.every((d) => d.total === 0)) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
        <p className="text-sm text-gray-400">{emptyMessage}</p>
        <p className="mt-2 text-xs text-gray-300">Os dados aparecerao automaticamente quando disponiveis.</p>
      </div>
    )
  }

  const max = Math.max(...dados.map((d) => d.total), 1)

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-4 text-sm font-bold text-gray-900">{title}</h3>
      <div className="space-y-2">
        {dados.map((item, idx) => (
          <div key={`${item.label}-${idx}`} className="flex items-center gap-3">
            <div className="w-28 truncate text-xs text-gray-600">{item.label}</div>
            <div className="h-7 flex-1 overflow-hidden rounded-full bg-gray-100">
              <div
                className="flex h-full items-center justify-end rounded-full bg-[#0097b2] pr-2 text-[11px] font-bold text-white"
                style={{ width: `${Math.max((item.total / max) * 100, 5)}%` }}
              >
                {item.total > 0 ? item.total : ''}
              </div>
            </div>
            <span className="w-10 text-right text-xs font-semibold text-gray-800">{item.total}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

