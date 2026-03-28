'use client'

import { useMemo, useState } from 'react'
import { useDashboardEmpresa } from '../../hooks/useDashboardEmpresa'
import { useFunilConversao } from '../../hooks/useFunilConversao'
import type { Periodo } from '../../types/dashboard.types'

import EtapaFunil from './EtapaFunil'
import CardRecomendacoes from './CardRecomendacoes'
import TopPaxProfissionais from './TopPaxProfissionais'
import ExportarRelatorio from '../shared/ExportarRelatorio'

interface Props {
  periodo: Periodo
}

export default function FunilConversao({ periodo }: Props) {
  const { dados: empresa } = useDashboardEmpresa()
  const empresaId = empresa?.id ?? null

  const { dados, recomendacoesPorProfissional, topPax, loading, error } = useFunilConversao(empresaId, periodo)

  const [expandedRec, setExpandedRec] = useState(false)
  const [expandedPax, setExpandedPax] = useState(false)

  const exportDados = useMemo(
    () => ({
      periodo,
      visualizacoes: dados?.visualizacoes ?? 0,
      seguidores: dados?.seguidores ?? 0,
      recomendacoes: dados?.recomendacoes ?? 0,
      pax: dados?.pax ?? 0,
      vendas: dados?.vendas ?? 0,
    }),
    [dados, periodo]
  )

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 rounded-lg bg-gray-100 animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-red-800">
        Erro ao carregar funil: {error.message}
      </div>
    )
  }

  if (!dados) {
    return (
      <div className="rounded-lg bg-gray-50 p-8 text-center text-gray-500">
        Nenhum dado disponível para o período selecionado
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <EtapaFunil icon="👁️" label="visualizações" valor={dados.visualizacoes} />

      <EtapaFunil icon="➕" label="novos seguidores" valor={dados.seguidores} offset="right" />

      <EtapaFunil
        icon="👥"
        label="recomendações"
        valor={dados.recomendacoes}
        offset="left"
        expanded={expandedRec}
        onToggle={() => setExpandedRec((v) => !v)}
      >
        <CardRecomendacoes recomendacoes={recomendacoesPorProfissional} />
      </EtapaFunil>

      <EtapaFunil
        icon="📍"
        label="PAX (check-ins)"
        valor={dados.pax}
        offset="right"
        expanded={expandedPax}
        onToggle={() => setExpandedPax((v) => !v)}
      >
        <TopPaxProfissionais topPax={topPax} />
      </EtapaFunil>

      <EtapaFunil icon="💰" label="vendas" valor={dados.vendas} offset="left" />

      <div className="mt-8 border-t border-gray-200 pt-4">
        <ExportarRelatorio dados={exportDados} tipo="funil" />
      </div>
    </div>
  )
}

