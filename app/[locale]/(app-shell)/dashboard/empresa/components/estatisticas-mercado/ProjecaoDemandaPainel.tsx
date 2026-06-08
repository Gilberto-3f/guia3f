'use client'

import { useMemo, useState } from 'react'
import type { ReservaHospedagemRow, AtendimentoProjecaoRow } from '@/lib/projecaoDemanda'
import {
  agregarAgendamentosAntecipados,
  agregarHistoricoSazonalidade,
  agregarMapaCalor,
  agregarOcupacaoHospedagem,
  dataLimiteProjecao,
  type ModoMapaCalor,
  type PeriodoProjecao,
  type TipoServicoProjecao,
} from '@/lib/projecaoDemanda'
import {
  CIDADES_TRIPLICE_ORDEM,
  CATEGORIAS_MOBILIDADE_ORDEM,
  type CategoriaMobilidade,
  type CidadeTriplice,
} from '@/lib/mobilidadeRegional'

import SubsecaoMercado from './SubsecaoMercado'
import GraficoLinhaComparativa from './GraficoLinhaComparativa'
import MapaCalor from './MapaCalor'
import GraficoAgendamentosAntecipados from './GraficoAgendamentosAntecipados'
import FiltroSelectMercado from './FiltroSelectMercado'

interface Props {
  reservasHospedagem: ReservaHospedagemRow[]
  atendimentosProjecao: AtendimentoProjecaoRow[]
}

export default function ProjecaoDemandaPainel({ reservasHospedagem, atendimentosProjecao }: Props) {
  const [periodoMapa, setPeriodoMapa] = useState<PeriodoProjecao>('30d')
  const [cidadeMapa, setCidadeMapa] = useState<CidadeTriplice | 'todas'>('todas')
  const [categoriaMapa, setCategoriaMapa] = useState<CategoriaMobilidade | 'todas'>('todas')
  const [modoMapa, setModoMapa] = useState<ModoMapaCalor>('regiao')

  const [cidadeHistorico, setCidadeHistorico] = useState<CidadeTriplice | 'todas'>('todas')
  const [categoriaHistorico, setCategoriaHistorico] = useState<CategoriaMobilidade | 'todas'>('todas')
  const [tipoHistorico, setTipoHistorico] = useState<TipoServicoProjecao>('todos')

  const [cidadeAgendamento, setCidadeAgendamento] = useState<CidadeTriplice | 'todas'>('todas')
  const [categoriaAgendamento, setCategoriaAgendamento] = useState<CategoriaMobilidade | 'todas'>('todas')

  const ocupacao = useMemo(() => agregarOcupacaoHospedagem(reservasHospedagem), [reservasHospedagem])

  const historico = useMemo(
    () =>
      agregarHistoricoSazonalidade(atendimentosProjecao, {
        cidade: cidadeHistorico === 'todas' ? null : cidadeHistorico,
        categoria: categoriaHistorico === 'todas' ? null : categoriaHistorico,
        tipoServico: tipoHistorico,
      }),
    [atendimentosProjecao, cidadeHistorico, categoriaHistorico, tipoHistorico],
  )

  const pontosCalor = useMemo(
    () =>
      agregarMapaCalor(atendimentosProjecao, {
        desde: dataLimiteProjecao(periodoMapa),
        cidade: cidadeMapa === 'todas' ? null : cidadeMapa,
        categoria: categoriaMapa === 'todas' ? null : categoriaMapa,
        modo: modoMapa,
      }),
    [atendimentosProjecao, periodoMapa, cidadeMapa, categoriaMapa, modoMapa],
  )

  const agendamentos = useMemo(
    () =>
      agregarAgendamentosAntecipados(atendimentosProjecao, {
        cidade: cidadeAgendamento === 'todas' ? null : cidadeAgendamento,
        categoria: categoriaAgendamento === 'todas' ? null : categoriaAgendamento,
      }),
    [atendimentosProjecao, cidadeAgendamento, categoriaAgendamento],
  )

  const opcoesCidade = [
    { valor: 'todas' as const, rotulo: 'Todas as cidades' },
    ...CIDADES_TRIPLICE_ORDEM.map((c) => ({ valor: c, rotulo: c })),
  ]
  const opcoesCategoria = [
    { valor: 'todas' as const, rotulo: 'Todas as categorias' },
    ...CATEGORIAS_MOBILIDADE_ORDEM.map((c) => ({ valor: c, rotulo: c })),
  ]

  const anoAtual = new Date().getFullYear()

  return (
    <div className="space-y-5">
      <SubsecaoMercado
        titulo="Ocupação de hospedagem"
        subtitulo="Taxa de ocupação mensal — (diárias reservadas ÷ diárias disponíveis) × 100"
      >
        <GraficoLinhaComparativa
          dados={ocupacao}
          unidade="%"
          semTitulo
          embed
          mostrarComZero
          rotuloAtual={String(anoAtual)}
          rotuloAnterior={String(anoAtual - 1)}
        />
        <p className="mt-2 text-center text-[11px] text-gray-400">
          Últimos 12 meses · Fonte: reservas_hospedagem
        </p>
      </SubsecaoMercado>

      <SubsecaoMercado
        titulo="Mapa de calor na região"
        subtitulo="Concentração de atendimentos concluídos na Tríplice Fronteira"
      >
        <MapaCalor
          pontos={pontosCalor}
          semTitulo
          embed
          periodo={periodoMapa}
          cidade={cidadeMapa}
          categoria={categoriaMapa}
          modo={modoMapa}
          onPeriodoChange={setPeriodoMapa}
          onCidadeChange={setCidadeMapa}
          onCategoriaChange={setCategoriaMapa}
          onModoChange={setModoMapa}
        />
      </SubsecaoMercado>

      <SubsecaoMercado
        titulo="Histórico de atendimentos"
        subtitulo="Comparativo de sazonalidade — dois anos consecutivos"
      >
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FiltroSelectMercado
            rotulo="Cidade"
            valor={cidadeHistorico}
            opcoes={opcoesCidade}
            onChange={setCidadeHistorico}
          />
          <FiltroSelectMercado
            rotulo="Categoria"
            valor={categoriaHistorico}
            opcoes={opcoesCategoria}
            onChange={setCategoriaHistorico}
          />
          <FiltroSelectMercado
            rotulo="Tipo de serviço"
            valor={tipoHistorico}
            opcoes={[
              { valor: 'todos', rotulo: 'Todos' },
              { valor: 'mobilidade', rotulo: 'Mobilidade' },
              { valor: 'hospedagem', rotulo: 'Hospedagem' },
            ]}
            onChange={setTipoHistorico}
          />
        </div>
        <GraficoLinhaComparativa
          dados={historico}
          unidade="qtd"
          semTitulo
          embed
          mostrarComZero
          rotuloAtual={String(anoAtual)}
          rotuloAnterior={String(anoAtual - 1)}
        />
      </SubsecaoMercado>

      <SubsecaoMercado
        titulo="Agendamentos antecipados"
        subtitulo="Reservas com 7+ dias de antecedência por mês do ano"
      >
        <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-md">
          <FiltroSelectMercado
            rotulo="Cidade"
            valor={cidadeAgendamento}
            opcoes={opcoesCidade}
            onChange={setCidadeAgendamento}
          />
          <FiltroSelectMercado
            rotulo="Categoria"
            valor={categoriaAgendamento}
            opcoes={opcoesCategoria}
            onChange={setCategoriaAgendamento}
          />
        </div>
        <GraficoAgendamentosAntecipados dados={agendamentos} semTitulo embed mostrarComZero />
      </SubsecaoMercado>
    </div>
  )
}
