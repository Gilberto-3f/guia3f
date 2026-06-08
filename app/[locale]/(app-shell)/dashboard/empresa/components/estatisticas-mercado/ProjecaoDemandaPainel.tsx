'use client'

import { useMemo, useState } from 'react'
import type { ReservaHospedagemRow, AtendimentoProjecaoRow } from '@/lib/projecaoDemanda'
import {
  agregarCalendarioAtendimentos,
  agregarCalendarioHospedagem,
  agregarTaxaAtendimentoAnual,
  agregarTaxaOcupacaoAnual,
} from '@/lib/projecaoDemanda'

import SubsecaoMercado from './SubsecaoMercado'
import GraficoCalendarioProjecao from './GraficoCalendarioProjecao'
import GraficoLinha from './GraficoLinha'
import FiltroSelectMercado from './FiltroSelectMercado'

interface Props {
  reservasHospedagem: ReservaHospedagemRow[]
  atendimentosProjecao: AtendimentoProjecaoRow[]
}

type AnoHistorico = 'atual' | 'anterior'

export default function ProjecaoDemandaPainel({ reservasHospedagem, atendimentosProjecao }: Props) {
  const [anoHistorico, setAnoHistorico] = useState<AnoHistorico>('atual')

  const anoReferencia = useMemo(() => {
    const hoje = new Date().getFullYear()
    return anoHistorico === 'atual' ? hoje : hoje - 1
  }, [anoHistorico])

  const calendarioHospedagem = useMemo(
    () => agregarCalendarioHospedagem(reservasHospedagem),
    [reservasHospedagem],
  )

  const calendarioAtendimentos = useMemo(
    () => agregarCalendarioAtendimentos(atendimentosProjecao),
    [atendimentosProjecao],
  )

  const taxaOcupacaoAnual = useMemo(
    () =>
      agregarTaxaOcupacaoAnual(reservasHospedagem, anoReferencia).map((p) => ({
        mes: p.mesLabel,
        valor: p.valor,
      })),
    [reservasHospedagem, anoReferencia],
  )

  const taxaAtendimentoAnual = useMemo(
    () =>
      agregarTaxaAtendimentoAnual(atendimentosProjecao, anoReferencia).map((p) => ({
        mes: p.mesLabel,
        valor: p.valor,
      })),
    [atendimentosProjecao, anoReferencia],
  )

  return (
    <div className="space-y-5">
      <SubsecaoMercado
        titulo="Reservas de Hospedagem"
        subtitulo="Reservas mapeadas para os próximos meses"
      >
        <GraficoCalendarioProjecao
          meses={calendarioHospedagem}
          unidade="%"
          semTitulo
          embed
          mostrarComZero
        />
        <p className="mt-1 text-center text-[11px] text-gray-400">
          Projeção de ocupação dos próximos 6 meses com base nas reservas feitas pelo app
        </p>
      </SubsecaoMercado>

      <SubsecaoMercado
        titulo="Atendimentos Agendados"
        subtitulo="Atendimento de profissionais reservados com antecedência"
      >
        <GraficoCalendarioProjecao
          meses={calendarioAtendimentos}
          unidade="%"
          semTitulo
          embed
          mostrarComZero
        />
        <p className="mt-1 text-center text-[11px] text-gray-400">
          Projeção de atendimento dos próximos 6 meses com base nos agendamentos feitos pelo app
        </p>
      </SubsecaoMercado>

      <SubsecaoMercado
        titulo="Histórico de Reservas e Agendamentos"
        subtitulo="Comparativo de sazonalidade dos dois últimos anos"
      >
        <div className="mb-4 flex justify-center">
          <FiltroSelectMercado
            rotulo="Ano"
            valor={anoHistorico}
            opcoes={[
              { valor: 'atual' as const, rotulo: 'Ano atual' },
              { valor: 'anterior' as const, rotulo: 'Ano anterior' },
            ]}
            onChange={setAnoHistorico}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-center text-xs font-medium text-gray-600">
              Taxa de ocupação mensal — {anoReferencia}
            </p>
            <GraficoLinha
              dados={taxaOcupacaoAnual}
              titulo=""
              cor="#001f3f"
              semTitulo
              embed
              unidade="%"
            />
          </div>
          <div>
            <p className="mb-2 text-center text-xs font-medium text-gray-600">
              Taxa de atendimento mensal — {anoReferencia}
            </p>
            <GraficoLinha
              dados={taxaAtendimentoAnual}
              titulo=""
              cor="#0097b2"
              semTitulo
              embed
              unidade="%"
            />
          </div>
        </div>
      </SubsecaoMercado>
    </div>
  )
}
