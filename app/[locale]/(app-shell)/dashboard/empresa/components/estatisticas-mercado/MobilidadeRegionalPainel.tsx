'use client'

import { useMemo, useState } from 'react'
import type { DadosDistribuicaoProfissionais } from '../../types/dashboard.types'
import type { AtendimentoMobilidadeRow } from '@/lib/mobilidadeRegional'
import {
  CIDADES_TRIPLICE_ORDEM,
  CATEGORIAS_MOBILIDADE_ORDEM,
  agregarAtendimentosPorCategoria,
  agregarHorariosPico,
  agregarProfissionaisPorCategoria,
  agregarProfissionaisPorCidade,
  dataLimiteMobilidade,
  detalheCategoriasPorCidade,
  type CategoriaMobilidade,
  type CidadeTriplice,
  type PeriodoMobilidade,
} from '@/lib/mobilidadeRegional'

import SubsecaoMercado from './SubsecaoMercado'
import GraficoPizza from './GraficoPizza'
import GraficoBarras from './GraficoBarras'
import GraficoHorarioPico from './GraficoHorarioPico'

interface Props {
  distribuicaoProfissionais: DadosDistribuicaoProfissionais[]
  profissionaisCategorias: { categorias: unknown }[]
  atendimentosMobilidade: AtendimentoMobilidadeRow[]
}

const OPCOES_PERIODO: { valor: PeriodoMobilidade; rotulo: string }[] = [
  { valor: '7d', rotulo: '7 dias' },
  { valor: '30d', rotulo: '30 dias' },
  { valor: '90d', rotulo: '90 dias' },
]

function FiltroSelect<T extends string>({
  rotulo,
  valor,
  opcoes,
  onChange,
}: {
  rotulo: string
  valor: T
  opcoes: { valor: T; rotulo: string }[]
  onChange: (v: T) => void
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-gray-600">
      <span className="font-medium">{rotulo}</span>
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value as T)}
        className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-[#001f3f]"
      >
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </label>
  )
}

export default function MobilidadeRegionalPainel({
  distribuicaoProfissionais,
  profissionaisCategorias,
  atendimentosMobilidade,
}: Props) {
  const [cidadeSelecionada, setCidadeSelecionada] = useState<CidadeTriplice | null>(null)
  const [periodoAtendimentos, setPeriodoAtendimentos] = useState<PeriodoMobilidade>('30d')
  const [cidadeAtendimentos, setCidadeAtendimentos] = useState<CidadeTriplice | 'todas'>('todas')
  const [periodoHorario, setPeriodoHorario] = useState<PeriodoMobilidade>('30d')
  const [cidadeHorario, setCidadeHorario] = useState<CidadeTriplice | 'todas'>('todas')
  const [categoriaHorario, setCategoriaHorario] = useState<CategoriaMobilidade | 'todas'>('todas')

  const pizzaCidades = useMemo(
    () => agregarProfissionaisPorCidade(distribuicaoProfissionais),
    [distribuicaoProfissionais],
  )

  const pizzaCategorias = useMemo(
    () => agregarProfissionaisPorCategoria(profissionaisCategorias),
    [profissionaisCategorias],
  )

  const detalheCidade = useMemo(() => {
    if (!cidadeSelecionada) return null
    return detalheCategoriasPorCidade(distribuicaoProfissionais, cidadeSelecionada)
  }, [cidadeSelecionada, distribuicaoProfissionais])

  const atendimentosRanking = useMemo(
    () =>
      agregarAtendimentosPorCategoria(atendimentosMobilidade, {
        desde: dataLimiteMobilidade(periodoAtendimentos),
        cidade: cidadeAtendimentos === 'todas' ? null : cidadeAtendimentos,
      }),
    [atendimentosMobilidade, periodoAtendimentos, cidadeAtendimentos],
  )

  const horariosPico = useMemo(
    () =>
      agregarHorariosPico(atendimentosMobilidade, {
        desde: dataLimiteMobilidade(periodoHorario),
        cidade: cidadeHorario === 'todas' ? null : cidadeHorario,
        categoria: categoriaHorario === 'todas' ? null : categoriaHorario,
        apenasConcluidos: true,
      }),
    [atendimentosMobilidade, periodoHorario, cidadeHorario, categoriaHorario],
  )

  const opcoesCidade = [
    { valor: 'todas' as const, rotulo: 'Todas as cidades' },
    ...CIDADES_TRIPLICE_ORDEM.map((c) => ({ valor: c, rotulo: c })),
  ]

  const opcoesCategoria = [
    { valor: 'todas' as const, rotulo: 'Todas as categorias' },
    ...CATEGORIAS_MOBILIDADE_ORDEM.map((c) => ({ valor: c, rotulo: c })),
  ]

  return (
    <div className="space-y-3">
      <SubsecaoMercado
        id="distribuicao-profissionais"
        titulo="Distribuição de profissionais"
        subtitulo="Concentração de profissionais na Tríplice Fronteira."
      >
        <div className="space-y-6">
          <div>
            <p className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-gray-500">Por cidade</p>
            <GraficoPizza
              dados={pizzaCidades}
              titulo=""
              semTitulo
              rosca
              embed
              mostrarComZero
              selecionado={cidadeSelecionada}
              onSegmentoClick={(label) =>
                setCidadeSelecionada((atual) => (atual === label ? null : (label as CidadeTriplice)))
              }
            />
          </div>
          <div>
            <p className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-gray-500">Por categoria</p>
            <GraficoPizza
              dados={pizzaCategorias}
              titulo=""
              semTitulo
              embed
              mostrarComZero
            />
          </div>
        </div>
        {cidadeSelecionada && detalheCidade ? (
          <div className="mt-4 rounded-lg border border-[#0097b2]/20 bg-[#0097b2]/5 p-3">
            <p className="mb-2 text-sm font-semibold text-[#001f3f]">
              {cidadeSelecionada} — por categoria profissional
            </p>
            <GraficoBarras dados={detalheCidade} semTitulo embed mostrarComZero />
          </div>
        ) : (
          <p className="text-center text-xs text-gray-400">Clique em um segmento para ver o detalhamento por categoria</p>
        )}
      </SubsecaoMercado>

      <SubsecaoMercado
        id="atendimentos-categoria"
        titulo="Atendimentos por categoria"
        subtitulo="Quantidade de atendimentos realizados por categoria profissional"
      >
        <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-md">
          <FiltroSelect
            rotulo="Período"
            valor={periodoAtendimentos}
            opcoes={OPCOES_PERIODO}
            onChange={setPeriodoAtendimentos}
          />
          <FiltroSelect
            rotulo="Cidade"
            valor={cidadeAtendimentos}
            opcoes={opcoesCidade}
            onChange={setCidadeAtendimentos}
          />
        </div>
        <GraficoBarras dados={atendimentosRanking} semTitulo embed mostrarComZero />
      </SubsecaoMercado>

      <SubsecaoMercado
        id="horario-pico"
        titulo="Horário de pico dos atendimentos particulares"
        subtitulo="Horários de maior demanda por serviços de mobilidade (atendimentos concluídos)"
      >
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FiltroSelect
            rotulo="Período"
            valor={periodoHorario}
            opcoes={OPCOES_PERIODO}
            onChange={setPeriodoHorario}
          />
          <FiltroSelect
            rotulo="Cidade"
            valor={cidadeHorario}
            opcoes={opcoesCidade}
            onChange={setCidadeHorario}
          />
          <FiltroSelect
            rotulo="Categoria"
            valor={categoriaHorario}
            opcoes={opcoesCategoria}
            onChange={setCategoriaHorario}
          />
        </div>
        <GraficoHorarioPico dados={horariosPico} semTitulo embed mostrarComZero />
      </SubsecaoMercado>
    </div>
  )
}
