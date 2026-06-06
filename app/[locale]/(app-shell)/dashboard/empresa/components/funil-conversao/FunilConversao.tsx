'use client'

import { useMemo, useState } from 'react'
import { DollarSign, Eye, MapPin, UserPlus, Users, type LucideIcon } from 'lucide-react'
import { useDashboardEmpresa } from '../../hooks/useDashboardEmpresa'
import { useFunilConversao } from '../../hooks/useFunilConversao'
import type { Periodo } from '../../types/dashboard.types'

import EtapaFunil from './EtapaFunil'
import CardRecomendacoes from './CardRecomendacoes'
import TopPaxProfissionais from './TopPaxProfissionais'
import CardVendas from './CardVendas'
import ExportarRelatorio from '../shared/ExportarRelatorio'
import CheckVerificado from '@/components/CheckVerificado'

interface Props {
  periodo: Periodo
}

type DetalheEtapa = 'recomendacoes' | 'pax' | 'vendas' | null

type EtapaFunilConfig =
  | {
      id: 'visualizacoes' | 'seguidores'
      expandable: false
      icon: LucideIcon
      label: string
      valor: number
      widthPercent: number
    }
  | {
      id: Exclude<DetalheEtapa, null>
      expandable: true
      icon: LucideIcon
      label: string
      valor: number
      widthPercent: number
    }

export default function FunilConversao({ periodo }: Props) {
  const { dados: empresa } = useDashboardEmpresa()
  const empresaId = empresa?.id ?? null

  const { dados, recomendacoesPorProfissional, topPax, loading, error } = useFunilConversao(empresaId, periodo)

  const [detalheAberto, setDetalheAberto] = useState<DetalheEtapa>(null)

  const toggleDetalhe = (etapa: Exclude<DetalheEtapa, null>) => {
    setDetalheAberto((atual) => (atual === etapa ? null : etapa))
  }

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
      <div className="mx-auto max-w-lg space-y-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="mx-auto h-20 animate-pulse rounded bg-gray-100"
            style={{ width: `${100 - i * 8}%` }}
          />
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

  const etapas: EtapaFunilConfig[] = [
    {
      id: 'visualizacoes' as const,
      icon: Eye,
      label: 'Visualizações',
      valor: dados.visualizacoes,
      widthPercent: 100,
      expandable: false,
    },
    {
      id: 'seguidores' as const,
      icon: UserPlus,
      label: 'Seguidores',
      valor: dados.seguidores,
      widthPercent: 88,
      expandable: false,
    },
    {
      id: 'recomendacoes' as const,
      icon: Users,
      label: 'Recomendações',
      valor: dados.recomendacoes,
      widthPercent: 76,
      expandable: true,
    },
    {
      id: 'pax' as const,
      icon: MapPin,
      label: 'PAX',
      valor: dados.pax,
      widthPercent: 64,
      expandable: true,
    },
    {
      id: 'vendas' as const,
      icon: DollarSign,
      label: 'Vendas',
      valor: dados.vendas,
      widthPercent: 52,
      expandable: true,
    },
  ]

  const username = empresa?.username?.trim().replace(/^@+/, '') ?? ''
  const usernameLabel = username ? `@${username}` : '@empresa'

  return (
    <div className="space-y-4 pb-1">
      <div className="mx-auto flex max-w-xl items-center justify-center gap-1.5">
        {empresa?.verificado ? <CheckVerificado className="h-5 w-5 shrink-0" /> : null}
        <p className="truncate text-lg font-extrabold text-[#0097b2] sm:text-xl">{usernameLabel}</p>
      </div>

      <div className="mx-auto flex max-w-xl flex-col gap-0">
        {etapas.map((etapa) => (
          <EtapaFunil
            key={etapa.id}
            icon={etapa.icon}
            label={etapa.label}
            valor={etapa.valor}
            widthPercent={etapa.widthPercent}
            expandable={etapa.expandable}
            selected={detalheAberto === etapa.id}
            onToggle={etapa.expandable ? () => toggleDetalhe(etapa.id) : undefined}
          />
        ))}
      </div>

      {detalheAberto ? (
        <div className="mx-auto max-w-xl rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          {detalheAberto === 'recomendacoes' ? <CardRecomendacoes recomendacoes={recomendacoesPorProfissional} /> : null}
          {detalheAberto === 'pax' ? <TopPaxProfissionais topPax={topPax} /> : null}
          {detalheAberto === 'vendas' ? <CardVendas total={dados.vendas} /> : null}
        </div>
      ) : null}

      <p className="mx-auto max-w-xl text-center text-sm leading-relaxed text-gray-600">
        <strong className="text-[#001f3f]">NOTA:</strong> O Funil de Conversão mostra o desempenho geral do nosso
        ecossistema com o seu negócio.
      </p>

      <div className="border-t border-gray-200 pt-3 pb-0">
        <ExportarRelatorio dados={exportDados} tipo="funil" />
      </div>
    </div>
  )
}
