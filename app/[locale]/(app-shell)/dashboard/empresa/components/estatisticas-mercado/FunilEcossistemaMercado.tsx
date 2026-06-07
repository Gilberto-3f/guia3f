'use client'

import { useEffect, useState } from 'react'
import { DollarSign, MapPin, Users } from 'lucide-react'
import { useFunilEcossistemaAgregado } from '../../hooks/useFunilEcossistemaAgregado'
import type { Periodo } from '../../types/dashboard.types'
import EtapaFunil from '../funil-conversao/EtapaFunil'
import RelatorioDetalhado from '../funil-conversao/RelatorioDetalhado'
import RecomendacoesCategoriaResumo from './RecomendacoesCategoriaResumo'

interface Props {
  periodo: Periodo
}

const CLIP_FUNIL = 'polygon(0% 0%, 100% 0%, 72% 100%, 28% 100%)'

export default function FunilEcossistemaMercado({ periodo }: Props) {
  const { dados, recomendacoesPorCategoria, loading, detalhesLoading, error, carregarDetalheRecomendacoes } =
    useFunilEcossistemaAgregado(periodo)

  const [detalheAberto, setDetalheAberto] = useState(false)

  useEffect(() => {
    if (detalheAberto) void carregarDetalheRecomendacoes()
  }, [carregarDetalheRecomendacoes, detalheAberto])

  if (loading) {
    return (
      <div className="mx-auto max-w-xl overflow-hidden shadow-md" style={{ clipPath: CLIP_FUNIL }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className={`h-16 animate-pulse bg-gray-100 sm:h-20 ${i < 2 ? 'border-b-[3px] border-white' : ''}`}
          />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-sm text-red-800">
        Erro ao carregar funil: {error.message}
      </div>
    )
  }

  if (!dados) {
    return <p className="text-center text-sm text-gray-500">Nenhum dado disponível para o período.</p>
  }

  const etapas = [
    { id: 'recomendacoes' as const, icon: Users, label: 'Recomendações', valor: dados.recomendacoes, expandable: true },
    { id: 'pax' as const, icon: MapPin, label: 'PAX', valor: dados.pax, expandable: false },
    { id: 'vendas' as const, icon: DollarSign, label: 'Vendas', valor: dados.vendas, expandable: false },
  ]

  return (
    <div className="space-y-4">
      <div className="mx-auto max-w-xl overflow-hidden shadow-md" style={{ clipPath: CLIP_FUNIL }}>
        {etapas.map((etapa, index) => (
          <EtapaFunil
            key={etapa.id}
            icon={etapa.icon}
            label={etapa.label}
            valor={etapa.valor}
            expandable={etapa.expandable}
            selected={etapa.expandable && detalheAberto}
            onToggle={
              etapa.expandable
                ? () => setDetalheAberto((atual) => !atual)
                : undefined
            }
            isLast={index === etapas.length - 1}
          />
        ))}
      </div>

      {detalheAberto ? (
        <RelatorioDetalhado subtitulo="Recomendações feitas por categorias de profissionais do Ecossistema.">
          {detalhesLoading ? (
            <div className="space-y-2 py-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100" />
              ))}
            </div>
          ) : (
            <RecomendacoesCategoriaResumo items={recomendacoesPorCategoria} />
          )}
        </RelatorioDetalhado>
      ) : null}

      <p className="mx-auto max-w-xl text-center text-xs leading-relaxed text-gray-500">
        Resultados agregados de todas as empresas do ecossistema no período selecionado.
      </p>
    </div>
  )
}
