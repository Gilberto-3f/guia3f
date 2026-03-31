'use client'

import type { DadoAtivo } from '../../types/admin.types'

export function GraficoPizza({ dados, loading, title }: { dados: DadoAtivo[] | null; loading: boolean; title: string }) {
  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-gray-200" />
  if (!dados || dados.length === 0) return <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-500">Sem dados disponíveis</div>

  const total = dados.reduce((acc, item) => acc + item.total, 0) || 1
  const ativo = dados.find((d) => d.status === 'ativo')?.total ?? 0
  const ativoPct = (ativo / total) * 100

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-4 text-sm font-bold text-gray-900">{title}</h3>
      <div className="flex items-center gap-4">
        <div
          className="h-28 w-28 rounded-full"
          style={{
            background: `conic-gradient(#22c55e 0% ${ativoPct}%, #d1d5db ${ativoPct}% 100%)`,
          }}
        />
        <div className="space-y-2 text-xs">
          {dados.map((item) => (
            <div key={item.status} className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${item.status === 'ativo' ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="text-gray-700">{item.status === 'ativo' ? 'Ativo' : 'Offline'}</span>
              <span className="font-bold text-gray-900">
                {item.total} ({((item.total / total) * 100).toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

