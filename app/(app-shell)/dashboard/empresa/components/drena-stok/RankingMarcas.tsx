'use client'

import type { MarcaRanking } from '../../types/dashboard.types'

interface Props {
  marcas: MarcaRanking[]
}

function getVariacaoIcon(variacao: number) {
  if (variacao > 30) return '🔥'
  if (variacao > 15) return '📈'
  if (variacao < -30) return '📉'
  return ''
}

export default function RankingMarcas({ marcas }: Props) {
  if (marcas.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-4">
        <h3 className="mb-4 font-bold text-[#001f3f]">🥈 Marcas Mais Pesquisadas</h3>
        <div className="py-8 text-center text-gray-500">Nenhum dado disponível</div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="mb-4 font-bold text-[#001f3f]">🥈 Marcas Mais Pesquisadas</h3>
      <div className="space-y-2">
        {marcas.slice(0, 10).map((marca, i) => {
          const icon = getVariacaoIcon(marca.variacao)
          return (
            <div key={marca.marca} className="flex items-center justify-between border-b border-gray-100 py-2">
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium text-gray-700">{i + 1}.</span>
                <span className="ml-2 text-sm font-medium text-gray-800">{marca.marca}</span>
                <span className="ml-2 text-xs text-gray-400">({marca.principal_produto})</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm text-gray-600">{marca.total_buscas.toLocaleString()} buscas</span>
                {icon ? (
                  <span className={`text-xs ${marca.variacao > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {icon} {marca.variacao > 0 ? '+' : ''}
                    {marca.variacao}%
                  </span>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

