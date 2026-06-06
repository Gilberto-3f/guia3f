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
import RelatorioDetalhado from './RelatorioDetalhado'
import ExportarRelatorio from '../shared/ExportarRelatorio'
import CheckVerificado from '@/components/CheckVerificado'
import { labelEtapaFunil } from './labelEtapaFunil'

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
    }
  | {
      id: Exclude<DetalheEtapa, null>
      expandable: true
      icon: LucideIcon
      label: string
      valor: number
    }

/** Funil com laterais diagonais retas (topo largo → base estreita). */
const CLIP_FUNIL = 'polygon(0% 0%, 100% 0%, 72% 100%, 28% 100%)'

export default function FunilConversao({ periodo }: Props) {
  const { dados: empresa } = useDashboardEmpresa()
  const empresaId = empresa?.id ?? null

  const {
    dados,
    recomendacoesPorProfissional,
    paxPorProfissional,
    vendasPorProfissional,
    vendasSemProfissional,
    loading,
    error,
  } = useFunilConversao(empresaId, periodo)

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
      <div className="mx-auto max-w-xl overflow-hidden shadow-md" style={{ clipPath: CLIP_FUNIL }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`h-16 animate-pulse bg-gray-100 sm:h-20 ${i < 4 ? 'border-b-[3px] border-white' : ''}`}
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
      label: labelEtapaFunil('visualizacoes', dados.visualizacoes),
      valor: dados.visualizacoes,
      expandable: false,
    },
    {
      id: 'seguidores' as const,
      icon: UserPlus,
      label: labelEtapaFunil('seguidores', dados.seguidores),
      valor: dados.seguidores,
      expandable: false,
    },
    {
      id: 'recomendacoes' as const,
      icon: Users,
      label: labelEtapaFunil('recomendacoes', dados.recomendacoes),
      valor: dados.recomendacoes,
      expandable: true,
    },
    {
      id: 'pax' as const,
      icon: MapPin,
      label: labelEtapaFunil('pax', dados.pax),
      valor: dados.pax,
      expandable: true,
    },
    {
      id: 'vendas' as const,
      icon: DollarSign,
      label: labelEtapaFunil('vendas', dados.vendas),
      valor: dados.vendas,
      expandable: true,
    },
  ]

  const username = empresa?.username?.trim().replace(/^@+/, '') ?? ''
  const usernameLabel = username ? `@${username}` : '@empresa'

  return (
    <div className="space-y-4 pb-0">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-0">
        <span className="inline-flex max-w-full items-center gap-1.5 text-lg font-normal text-gray-900 sm:text-xl">
          {empresa?.verificado ? <CheckVerificado className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" /> : null}
          <span className="truncate">{usernameLabel}</span>
        </span>
        <p className="text-center text-sm leading-tight text-gray-500">Seus dados convertidos em resultados</p>
      </div>

      <div className="mx-auto max-w-xl overflow-hidden shadow-md" style={{ clipPath: CLIP_FUNIL }}>
        {etapas.map((etapa, index) => (
          <EtapaFunil
            key={etapa.id}
            icon={etapa.icon}
            label={etapa.label}
            valor={etapa.valor}
            expandable={etapa.expandable}
            selected={detalheAberto === etapa.id}
            onToggle={etapa.expandable ? () => toggleDetalhe(etapa.id) : undefined}
            isLast={index === etapas.length - 1}
          />
        ))}
      </div>

      {detalheAberto ? (
        <RelatorioDetalhado
          subtitulo={
            detalheAberto === 'recomendacoes'
              ? 'Recomendações feitas por profissionais'
              : detalheAberto === 'pax'
                ? 'PAX registrados por profissionais'
                : 'Vendas diretas no período'
          }
        >
          {detalheAberto === 'recomendacoes' ? (
            <CardRecomendacoes recomendacoes={recomendacoesPorProfissional} />
          ) : null}
          {detalheAberto === 'pax' ? <TopPaxProfissionais paxPorProfissional={paxPorProfissional} /> : null}
          {detalheAberto === 'vendas' ? (
            <CardVendas
              vendasPorProfissional={vendasPorProfissional}
              vendasSemProfissional={vendasSemProfissional}
            />
          ) : null}
        </RelatorioDetalhado>
      ) : null}

      <div className="border-t border-gray-200 pt-3">
        <ExportarRelatorio dados={exportDados} tipo="funil" />
      </div>

      <p className="mx-auto max-w-xl pt-2 text-center text-sm leading-relaxed text-gray-600">
        <strong className="text-[#001f3f]">NOTA:</strong> O Funil de Conversão mostra o desempenho geral do nosso
        ecossistema com o seu negócio.
      </p>
    </div>
  )
}
