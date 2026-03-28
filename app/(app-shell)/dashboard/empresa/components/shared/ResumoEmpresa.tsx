'use client'

import { useDashboardEmpresa } from '../../hooks/useDashboardEmpresa'

export default function ResumoEmpresa() {
  const { dados, loading } = useDashboardEmpresa()

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="mb-2 h-6 w-1/3 rounded bg-gray-200" />
        <div className="h-4 w-1/4 rounded bg-gray-200" />
      </div>
    )
  }

  if (!dados) return null

  const planoClass =
    dados.plano === 'Premium'
      ? 'bg-purple-100 text-purple-800'
      : dados.plano === 'Enterprise'
        ? 'bg-yellow-100 text-yellow-800'
        : 'bg-gray-100 text-gray-800'

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-bold text-[#001f3f]">{dados.nome}</h1>
        <p className="truncate text-sm text-gray-500">@{dados.username}</p>
      </div>

      <div className="shrink-0 text-right">
        <div className="flex items-center justify-end gap-2">
          <span className="text-yellow-500">⭐ {dados.nota_media.toFixed(1)}</span>
          <span className="text-sm text-gray-400">({dados.total_avaliacoes} avaliações)</span>
        </div>
        <div className="mt-1 flex items-center justify-end gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs ${planoClass}`}>💎 {dados.plano}</span>
          {dados.verificado ? <span className="text-xs text-green-600">✅ Verificado</span> : null}
        </div>
      </div>
    </div>
  )
}

