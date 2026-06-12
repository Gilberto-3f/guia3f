'use client'

import { useCallback, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Banknote,
  ShoppingBag,
  Building2,
  Headphones,
  Route,
  PieChart,
} from 'lucide-react'
import { useGraficosAdm, type PeriodoAdm } from '../../../hooks/useGraficosAdm'
import { AdminSecaoChevron } from '../../shared/AdminSecaoChevron'
import { FiltroPeriodoCompacto } from '../../shared/FiltroPeriodoCompacto'
import AtendimentosCategoria from './AtendimentosCategoria'
import AtendimentosCidade from './AtendimentosCidade'
import RankingRotas from './RankingRotas'
import VendasPorCategoriaChart from './VendasPorCategoriaChart'
import { ResumoVendasConcluidas } from './ResumoVendasConcluidas'
import { MetricaResumoCentral } from './MetricaResumoCentral'

const COR_LOGO = '#0097b2'

type SecaoId =
  | 'receita'
  | 'vendas'
  | 'assinantes'
  | 'atendimentos'
  | 'rotas'
  | 'vendas-categoria'

type SecaoMeta = {
  titulo: string
  subtitulo: string
  Icon: LucideIcon
  descricao: string
}

const SECOES: Record<SecaoId, SecaoMeta> = {
  receita: {
    titulo: 'Receita Bruta',
    subtitulo: 'Movimentação da Mobilidade',
    Icon: Banknote,
    descricao: 'Volume financeiro da mobilidade na plataforma. Mantido zerado enquanto a mobilidade não estiver operacional.',
  },
  vendas: {
    titulo: 'Vendas Concluídas',
    subtitulo: 'Serviços + Botão Dinâmico',
    Icon: ShoppingBag,
    descricao: 'Quantidade de vendas concluídas pelo app, com resumo entre serviços de profissionais (mobilidade) e de empresas (guia turístico).',
  },
  assinantes: {
    titulo: 'Assinantes',
    subtitulo: 'Empresas contratantes',
    Icon: Building2,
    descricao: 'Quantidade de empresas com plano contratado nos serviços da plataforma.',
  },
  atendimentos: {
    titulo: 'Quantidade de Atendimento',
    subtitulo: 'Por categoria e por cidade de origem',
    Icon: Headphones,
    descricao: 'Atendimentos realizados por categoria de profissionais e por cidade de origem na Tríplice Fronteira.',
  },
  rotas: {
    titulo: '15 Rotas Mais Solicitadas',
    subtitulo: 'Mobilidade',
    Icon: Route,
    descricao: 'Ranking das 15 rotas mais utilizadas nos serviços de mobilidade. Atualizado diariamente.',
  },
  'vendas-categoria': {
    titulo: 'Quantidade de Vendas',
    subtitulo: 'Por categoria de profissionais e segmento de empresas',
    Icon: PieChart,
    descricao: 'Comunidade profissional e segmento de empresa que mais venderam no período (quantidade, não valor).',
  },
}

const ORDEM_SECOES: SecaoId[] = [
  'receita',
  'vendas',
  'assinantes',
  'atendimentos',
  'rotas',
  'vendas-categoria',
]

function semDados(lista: { total: number }[]) {
  return lista.length === 0 || lista.every((d) => d.total === 0)
}

export function GraficosAdm() {
  const [periodo, setPeriodo] = useState<PeriodoAdm>('30d')
  const {
    atendimentosCategoria,
    atendimentosCidade,
    rotas,
    vendasProfissionalCategoria,
    vendasEmpresaSegmento,
    vendasConcluidas,
    assinantes,
    loading,
    error,
  } = useGraficosAdm(periodo)

  const [abertos, setAbertos] = useState<Record<SecaoId, boolean>>(() =>
    Object.fromEntries(ORDEM_SECOES.map((id) => [id, false])) as Record<SecaoId, boolean>,
  )

  const toggle = useCallback((id: SecaoId) => {
    setAbertos((atual) => ({ ...atual, [id]: !atual[id] }))
  }, [])

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-center text-sm text-rose-700">
        Erro ao carregar gráficos: {error.message}
      </div>
    )
  }

  function renderConteudo(id: SecaoId) {
    switch (id) {
      case 'receita':
        return (
          <MetricaResumoCentral
            valor="R$ 0,00"
            unidade="Movimentação da mobilidade"
            observacao="Mobilidade ainda não funcional — valor mantido zerado."
          />
        )
      case 'vendas':
        return <ResumoVendasConcluidas dados={vendasConcluidas} />
      case 'assinantes':
        return (
          <MetricaResumoCentral
            valor={assinantes.toLocaleString('pt-BR')}
            unidade="empresas contratantes"
          />
        )
      case 'atendimentos':
        return (
          <div className="space-y-6">
            <div>
              <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-[#0097b2]">
                Por categoria de profissionais
              </p>
              {semDados(atendimentosCategoria) ? (
                <p className="text-center text-xs text-gray-500">Sem atendimentos no período selecionado.</p>
              ) : (
                <AtendimentosCategoria dados={atendimentosCategoria} />
              )}
            </div>
            <div>
              <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-[#0097b2]">
                Por cidade de origem
              </p>
              {semDados(atendimentosCidade) ? (
                <p className="text-center text-xs text-gray-500">Sem atendimentos por cidade no período.</p>
              ) : (
                <AtendimentosCidade dados={atendimentosCidade} />
              )}
            </div>
          </div>
        )
      case 'rotas':
        return <RankingRotas rotas={rotas} />
      case 'vendas-categoria':
        return (
          <div className="space-y-6">
            <div>
              <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-[#0097b2]">
                Comunidade profissional (mobilidade)
              </p>
              {semDados(vendasProfissionalCategoria) ? (
                <p className="text-center text-xs text-gray-500">Sem vendas de profissionais no período.</p>
              ) : (
                <VendasPorCategoriaChart dados={vendasProfissionalCategoria} />
              )}
            </div>
            <div>
              <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-[#0097b2]">
                Segmento de empresa (guia turístico)
              </p>
              {semDados(vendasEmpresaSegmento) ? (
                <p className="text-center text-xs text-gray-500">Sem vendas de empresas no período.</p>
              ) : (
                <VendasPorCategoriaChart dados={vendasEmpresaSegmento} />
              )}
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex justify-center pb-1">
        <FiltroPeriodoCompacto value={periodo} onChange={(p) => setPeriodo(p as PeriodoAdm)} />
      </div>

      <div className="space-y-3">
        {ORDEM_SECOES.map((id) => {
          const meta = SECOES[id]
          return (
            <AdminSecaoChevron
              key={id}
              titulo={meta.titulo}
              tituloGrande
              aberta={Boolean(abertos[id])}
              onToggle={() => toggle(id)}
              icone={meta.Icon}
              corTitulo={COR_LOGO}
              descricao={`${meta.subtitulo}. ${meta.descricao}`}
            >
              {renderConteudo(id)}
            </AdminSecaoChevron>
          )
        })}
      </div>
    </div>
  )
}
