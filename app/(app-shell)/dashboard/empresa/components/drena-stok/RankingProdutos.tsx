'use client'

import type { ProdutoRanking } from '../../types/dashboard.types'

interface Props {
  produtos: ProdutoRanking[]
}

function getVariacaoIcon(variacao: number) {
  if (variacao > 30) return '🔥'
  if (variacao > 15) return '📈'
  if (variacao < -30) return '📉'
  return ''
}

export default function RankingProdutos({ produtos }: Props) {
  if (produtos.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-4">
        <h3 className="mb-4 font-bold text-[#001f3f]">🥇 Produtos Mais Buscados</h3>
        <div className="py-8 text-center text-gray-500">Nenhum dado disponível</div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="mb-4 font-bold text-[#001f3f]">🥇 Produtos Mais Buscados (TOP 30)</h3>
      <div className="max-h-96 space-y-2 overflow-y-auto">
        {produtos.map((prod, i) => {
          const icon = getVariacaoIcon(prod.variacao)
          return (
            <div key={prod.id} className="flex items-center justify-between border-b border-gray-100 py-2">
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium text-gray-700">{i + 1}.</span>
                <span className="ml-2 text-sm text-gray-800">{prod.nome}</span>
                <span className="ml-2 text-xs text-gray-400">({prod.categoria_drena})</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm text-gray-600">{prod.total_buscas.toLocaleString()} buscas</span>
                {icon ? (
                  <span className={`text-xs ${prod.variacao > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {icon} {prod.variacao > 0 ? '+' : ''}
                    {prod.variacao}%
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

