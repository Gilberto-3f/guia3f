'use client'

import type { DadoRosca } from '../../types/admin.types'

export function GraficoRosca({ dados, loading, title }: { dados: DadoRosca | null; loading: boolean; title: string }) {
  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-gray-200" />
  if (!dados) return <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-500">Sem dados disponíveis</div>

  const total = Math.max(dados.atual + dados.anterior, 1)
  const atualPct = (dados.atual / total) * 100
  const up = dados.variacao >= 0

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-4 text-sm font-bold text-gray-900">{title}</h3>
      <div className="flex items-center gap-4">
        <div
          className="relative h-28 w-28 rounded-full"
          style={{ background: `conic-gradient(#0097b2 0% ${atualPct}%, #e5e7eb ${atualPct}% 100%)` }}
        >
          <div className="absolute inset-4 rounded-full bg-white" />
        </div>
        <div className="space-y-1 text-xs">
          <div className="text-gray-700">
            Mês atual: <span className="font-bold text-gray-900">{dados.atual}</span>
          </div>
          <div className="text-gray-700">
            Mês anterior: <span className="font-bold text-gray-900">{dados.anterior}</span>
          </div>
          <div className={`font-bold ${up ? 'text-emerald-700' : 'text-rose-700'}`}>{up ? '↑' : '↓'} {Math.abs(dados.variacao).toFixed(1)}%</div>
        </div>
      </div>
    </div>
  )
}

