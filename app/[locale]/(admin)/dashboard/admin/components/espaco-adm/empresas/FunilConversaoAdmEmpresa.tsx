'use client'

import { useEffect, useMemo, useState } from 'react'
import { DollarSign, Eye, Heart, MapPin, Users, type LucideIcon } from 'lucide-react'
import { useFunilConversao } from '@/app/[locale]/(app-shell)/dashboard/empresa/hooks/useFunilConversao'
import type { Periodo } from '@/app/[locale]/(app-shell)/dashboard/empresa/types/dashboard.types'
import EtapaFunil from '@/app/[locale]/(app-shell)/dashboard/empresa/components/funil-conversao/EtapaFunil'
import CardRecomendacoes from '@/app/[locale]/(app-shell)/dashboard/empresa/components/funil-conversao/CardRecomendacoes'
import TopPaxProfissionais from '@/app/[locale]/(app-shell)/dashboard/empresa/components/funil-conversao/TopPaxProfissionais'
import CardVendas from '@/app/[locale]/(app-shell)/dashboard/empresa/components/funil-conversao/CardVendas'
import RelatorioDetalhado from '@/app/[locale]/(app-shell)/dashboard/empresa/components/funil-conversao/RelatorioDetalhado'
import CheckVerificado from '@/components/CheckVerificado'
import { labelEtapaFunil } from '@/app/[locale]/(app-shell)/dashboard/empresa/components/funil-conversao/labelEtapaFunil'

/** Números com 3+ dígitos (≥ 100) ocultam o ícone no funil ADM mobile. */
function funilAdmOcultarIcone(valor: number): boolean {
  return valor >= 100
}

type DetalheEtapa = 'recomendacoes' | 'pax' | 'vendas' | null

type EtapaFunilConfig =
  | {
      id: 'visualizacoes' | 'interacoes'
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

const CLIP_FUNIL = 'polygon(0% 0%, 100% 0%, 72% 100%, 28% 100%)'

export function FunilConversaoAdmEmpresa({
  empresaId,
  empresaUsuarioId,
  username,
  verificado = false,
  periodo,
}: {
  empresaId: string
  empresaUsuarioId: string | null
  username: string
  verificado?: boolean
  periodo: Periodo
}) {
  const {
    dados,
    recomendacoesPorProfissional,
    paxPorProfissional,
    vendasPorProfissional,
    vendasSemProfissional,
    loading,
    detalhesLoading,
    error,
    carregarDetalhes,
  } = useFunilConversao(empresaId, empresaUsuarioId, periodo)

  const [detalheAberto, setDetalheAberto] = useState<DetalheEtapa>(null)

  const toggleDetalhe = (etapa: Exclude<DetalheEtapa, null>) => {
    setDetalheAberto((atual) => (atual === etapa ? null : etapa))
  }

  useEffect(() => {
    if (detalheAberto) void carregarDetalhes(detalheAberto)
  }, [carregarDetalhes, detalheAberto])

  const usernameLabel = useMemo(() => {
    const u = username.trim().replace(/^@+/, '')
    return u ? `@${u}` : '@empresa'
  }, [username])

  if (loading && !dados) {
    return (
      <div className="w-full overflow-hidden shadow-md" style={{ clipPath: CLIP_FUNIL }}>
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
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-sm text-red-800">
        Erro ao carregar funil: {error.message}
      </div>
    )
  }

  if (!dados) {
    return (
      <div className="rounded-lg bg-gray-50 p-6 text-center text-sm text-gray-500">
        Nenhum dado disponível para o período selecionado
      </div>
    )
  }

  const etapas: EtapaFunilConfig[] = [
    {
      id: 'visualizacoes',
      icon: Eye,
      label: labelEtapaFunil('visualizacoes', dados.visualizacoes),
      valor: dados.visualizacoes,
      expandable: false,
    },
    {
      id: 'interacoes',
      icon: Heart,
      label: labelEtapaFunil('interacoes', dados.interacoes),
      valor: dados.interacoes,
      expandable: false,
    },
    {
      id: 'recomendacoes',
      icon: Users,
      label: labelEtapaFunil('recomendacoes', dados.recomendacoes),
      valor: dados.recomendacoes,
      expandable: true,
    },
    {
      id: 'pax',
      icon: MapPin,
      label: labelEtapaFunil('pax', dados.pax),
      valor: dados.pax,
      expandable: true,
    },
    {
      id: 'vendas',
      icon: DollarSign,
      label: labelEtapaFunil('vendas', dados.vendas),
      valor: dados.vendas,
      expandable: true,
    },
  ]

  return (
    <div className="space-y-4 py-2">
      <div className="flex w-full flex-col items-center gap-0">
        <span className="inline-flex max-w-full items-center gap-1.5 text-lg font-normal text-gray-900 sm:text-xl">
          {verificado ? <CheckVerificado /> : null}
          <span className="truncate">{usernameLabel}</span>
        </span>
        <p className="text-center text-sm leading-tight text-gray-500">dados convertidos em resultados</p>
      </div>

      <div className="w-full overflow-hidden shadow-md" style={{ clipPath: CLIP_FUNIL }}>
        {etapas.map((etapa, index) => (
          <EtapaFunil
            key={etapa.id}
            icon={etapa.icon}
            label={etapa.label}
            valor={etapa.valor}
            ocultarIcone={funilAdmOcultarIcone(etapa.valor)}
            naoLidas={0}
            expandable={etapa.expandable}
            selected={detalheAberto === etapa.id}
            onToggle={etapa.expandable ? () => toggleDetalhe(etapa.id) : undefined}
            isLast={index === etapas.length - 1}
            variant="adm"
          />
        ))}
      </div>

      {detalheAberto ? (
        <RelatorioDetalhado
          subtitulo={
            detalheAberto === 'recomendacoes'
              ? 'Recomendações feitas por Profissionais do Ecossistema.'
              : detalheAberto === 'pax'
                ? 'PAX - Passageiros no local'
                : 'Vendas Concluídas!'
          }
        >
          {detalhesLoading === detalheAberto ? (
            <div className="space-y-2 py-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100" />
              ))}
            </div>
          ) : null}
          {detalheAberto === 'recomendacoes' && detalhesLoading !== 'recomendacoes' ? (
            <CardRecomendacoes
              recomendacoes={recomendacoesPorProfissional}
              referenciaVistoEm={null}
              pastasVistas={new Set()}
              profissionaisVistos={new Set()}
              onPastaVista={() => {}}
              onProfissionalVisto={() => {}}
            />
          ) : null}
          {detalheAberto === 'pax' && detalhesLoading !== 'pax' ? (
            <TopPaxProfissionais
              paxPorProfissional={paxPorProfissional}
              referenciaVistoEm={null}
              pastasVistas={new Set()}
              profissionaisVistos={new Set()}
              onPastaVista={() => {}}
              onProfissionalVisto={() => {}}
            />
          ) : null}
          {detalheAberto === 'vendas' && detalhesLoading !== 'vendas' ? (
            <CardVendas
              vendasPorProfissional={vendasPorProfissional}
              vendasSemProfissional={vendasSemProfissional}
              referenciaVistoEm={null}
              pastasVistas={new Set()}
              profissionaisVistos={new Set()}
              onPastaVista={() => {}}
              onProfissionalVisto={() => {}}
            />
          ) : null}
        </RelatorioDetalhado>
      ) : null}
    </div>
  )
}
