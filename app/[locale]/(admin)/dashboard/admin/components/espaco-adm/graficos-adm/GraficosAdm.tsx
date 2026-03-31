'use client'

import { useState } from 'react'
import { useGraficosAdm } from '../../../hooks/useGraficosAdm'
import { PlaceholderCard } from '../../shared/PlaceholderCard'
import AtendimentosCategoria from './AtendimentosCategoria'
import AtendimentosCidade from './AtendimentosCidade'
import ComissoesPagas from './ComissoesPagas'
import RankingRotas from './RankingRotas'

export function GraficosAdm() {
  const [periodo, setPeriodo] = useState<'7d' | '30d' | '90d' | '12m'>('30d')
  const { atendimentosCategoria, atendimentosCidade, rotas, comissoesCategoria, receita, loading, error } = useGraficosAdm(periodo)

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl bg-gray-100" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        Erro ao carregar gráficos: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="flex gap-1 rounded-full bg-gray-100 p-1 text-xs font-semibold">
          {(['7d', '30d', '90d', '12m'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriodo(p)}
              className={`rounded-full px-3 py-1 ${periodo === p ? 'bg-white text-[#0097b2] shadow' : 'text-gray-600'}`}
            >
              {p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : p === '90d' ? '90 dias' : '12 meses'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="text-xs font-semibold text-gray-500">💰 Receita total</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">
            R$ {receita ? receita.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
          </div>
          <div className="mt-1 text-[11px] font-semibold text-emerald-700">
            {receita ? `${receita.variacao >= 0 ? '↑' : '↓'} ${Math.abs(receita.variacao).toFixed(1)}%` : '0%'}
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="text-xs font-semibold text-gray-500">🏢 Comissões</div>
          <div className="mt-1 text-lg font-bold text-gray-900">
            R$ {receita ? receita.breakdown.comissoes.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="text-xs font-semibold text-gray-500">📦 Assinaturas</div>
          <div className="mt-1 text-lg font-bold text-gray-900">
            R$ {receita ? receita.breakdown.assinaturas.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="text-sm font-bold text-gray-900">📊 Atendimentos por categoria</div>
          {atendimentosCategoria.length === 0 || atendimentosCategoria.every((d) => d.total === 0) ? (
            <div className="mt-4 text-xs text-gray-500">Sem dados para o período selecionado.</div>
          ) : (
            <AtendimentosCategoria dados={atendimentosCategoria} />
          )}
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="text-sm font-bold text-gray-900">🏙️ Atendimentos por cidade</div>
          {atendimentosCidade.length === 0 || atendimentosCidade.every((d) => d.total === 0) ? (
            <div className="mt-4 text-xs text-gray-500">Sem dados para o período selecionado.</div>
          ) : (
            <AtendimentosCidade dados={atendimentosCidade} />
          )}
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="text-sm font-bold text-gray-900">🚗 Top 15 rotas</div>
          <RankingRotas rotas={rotas} />
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="text-sm font-bold text-gray-900">💼 Comissões por categoria</div>
          {comissoesCategoria.length === 0 || comissoesCategoria.every((d) => d.total === 0) ? (
            <div className="mt-4 text-xs text-gray-500">Sem comissões registradas no período.</div>
          ) : (
            <ComissoesPagas dados={comissoesCategoria} />
          )}
        </div>
        <PlaceholderCard title="Próximos gráficos operacionais" />
      </div>
    </div>
  )
}

