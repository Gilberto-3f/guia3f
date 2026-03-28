'use client'

import type { DadosFunil } from '../../../hooks/useFunilConversao'

export function FunilConversaoCard({ dados }: { dados: DadosFunil }) {
  const etapas = [
    { label: '👁️ Visualizações', valor: dados.visualizacoes, percentual: 100 },
    { label: '➕ Novos seguidores', valor: dados.seguidores, percentual: dados.conversao_seguidores },
    { label: '👥 Recomendações', valor: dados.recomendacoes, percentual: dados.conversao_recomendacoes },
    { label: '📍 PAX (check-ins)', valor: dados.pax, percentual: dados.conversao_pax },
    { label: '💰 Vendas diretas', valor: dados.vendas, percentual: dados.conversao_vendas },
  ]

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-bold text-gray-900">{dados.empresa_nome || 'Empresa'}</div>
      <div className="mt-3 space-y-3">
        {etapas.map((etapa, i) => (
          <div key={i}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-gray-800">{etapa.label}</span>
              <span className="font-semibold text-gray-900">{etapa.valor}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-200">
              <div
                className="h-2 rounded-full bg-[#0097b2] transition-all"
                style={{ width: `${Math.max(0, Math.min(100, etapa.percentual))}%` }}
              />
            </div>
            {i < etapas.length - 1 ? (
              <div className="mt-1 text-xs text-gray-500">Conversão: {etapa.percentual.toFixed(1)}%</div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

