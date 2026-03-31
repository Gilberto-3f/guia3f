'use client'

import { useState } from 'react'
import { useFunilConversao } from '../../../hooks/useFunilConversao'
import { FunilConversaoCard } from './FunilConversaoCard'

export function FunilConversaoLista({ empresaId }: { empresaId: string | null }) {
  const [periodo, setPeriodo] = useState<'7d' | '30d' | '90d'>('30d')
  const { dados, loading, error } = useFunilConversao(empresaId, periodo)

  if (!empresaId) {
    return <div className="rounded-2xl bg-gray-50 p-8 text-center text-sm text-gray-500">Selecione uma empresa para ver o funil de conversão</div>
  }

  if (loading) {
    return (
      <div className="animate-pulse rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="h-5 w-1/3 rounded bg-gray-200" />
        <div className="mt-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 rounded bg-gray-100" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-center text-sm text-rose-800">
        Erro ao carregar funil: {error.message}
      </div>
    )
  }

  if (!dados || (dados.visualizacoes === 0 && dados.seguidores === 0 && dados.recomendacoes === 0 && dados.pax === 0 && dados.vendas === 0)) {
    return (
      <div className="rounded-2xl bg-gray-50 p-8 text-center text-sm text-gray-500">
        Nenhum dado disponível para esta empresa no período selecionado
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="flex gap-1 rounded-full bg-gray-100 p-1 text-xs font-semibold">
          {(['7d', '30d', '90d'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriodo(p)}
              className={`rounded-full px-3 py-1 ${periodo === p ? 'bg-white text-[#0097b2] shadow' : 'text-gray-600'}`}
            >
              {p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : '90 dias'}
            </button>
          ))}
        </div>
      </div>

      <FunilConversaoCard dados={dados} />
    </div>
  )
}

