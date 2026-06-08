'use client'

import { useMemo } from 'react'
import type { AgendamentoMensal } from '@/lib/projecaoDemanda'

interface Props {
  dados: AgendamentoMensal[]
  semTitulo?: boolean
  embed?: boolean
  mostrarComZero?: boolean
}

export default function GraficoAgendamentosAntecipados({
  dados,
  semTitulo = false,
  embed = false,
  mostrarComZero = true,
}: Props) {
  const wrap = embed ? 'min-h-[14rem]' : 'min-h-[14rem] rounded-lg border bg-white p-4'

  const maxValor = useMemo(
    () => Math.max(...dados.map((d) => Math.max(d.confirmados + d.pendentes, d.projecao)), 1),
    [dados],
  )

  const total = dados.reduce((s, d) => s + d.confirmados + d.pendentes, 0)
  const vazio = dados.length === 0 || (!mostrarComZero && total === 0)

  if (vazio) {
    return (
      <div className={wrap}>
        {!semTitulo ? <h3 className="mb-4 font-bold text-[#001f3f]">Agendamentos antecipados</h3> : null}
        <div className="flex h-48 items-center justify-center text-sm text-gray-500">Nenhum agendamento antecipado</div>
      </div>
    )
  }

  const hojeMes = new Date().getMonth()

  return (
    <div className={wrap}>
      {!semTitulo ? <h3 className="mb-4 font-bold text-[#001f3f]">Agendamentos antecipados</h3> : null}
      <div className="mb-3 flex justify-center gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#001f3f]" /> Confirmados
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#0097b2]/40" /> Pendentes
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 border-t-2 border-dashed border-[#E74C3C]" /> Projeção
        </span>
      </div>
      <div className="relative flex items-end justify-between gap-0.5 sm:gap-1" style={{ minHeight: '10rem' }}>
        {dados.map((item) => {
          const totalMes = item.confirmados + item.pendentes
          const alturaTotal = maxValor > 0 ? (totalMes / maxValor) * 100 : 0
          const alturaConf = totalMes > 0 ? (item.confirmados / totalMes) * alturaTotal : 0
          const alturaPend = totalMes > 0 ? (item.pendentes / totalMes) * alturaTotal : 0
          const temProjecao = item.mes > hojeMes && item.projecao > 0
          const alturaProj = temProjecao ? (item.projecao / maxValor) * 100 : 0

          return (
            <div key={item.mes} className="relative flex min-w-0 flex-1 flex-col items-center gap-0.5">
              {totalMes > 0 ? (
                <span className="text-[8px] font-medium tabular-nums text-[#001f3f] sm:text-[9px]">{totalMes}</span>
              ) : null}
              <div className="relative flex w-full max-w-[1.5rem] flex-col items-center justify-end" style={{ height: '8rem' }}>
                {temProjecao ? (
                  <div
                    className="absolute bottom-0 w-full border-t-2 border-dashed border-[#E74C3C]"
                    style={{ height: `${Math.max(alturaProj, 4)}%` }}
                    title={`Projeção ${item.mesLabel}: ${item.projecao}`}
                  />
                ) : null}
                <div className="flex w-full flex-col justify-end" style={{ height: `${Math.max(alturaTotal, totalMes > 0 ? 6 : 2)}%` }}>
                  {item.confirmados > 0 ? (
                    <div
                      className="w-full bg-[#001f3f]"
                      style={{ height: `${(alturaConf / Math.max(alturaTotal, 1)) * 100}%`, minHeight: item.confirmados > 0 ? '2px' : 0 }}
                      title={`${item.mesLabel}: ${item.confirmados} confirmados`}
                    />
                  ) : null}
                  {item.pendentes > 0 ? (
                    <div
                      className="w-full rounded-t-sm bg-[#0097b2]/40"
                      style={{ height: `${(alturaPend / Math.max(alturaTotal, 1)) * 100}%`, minHeight: item.pendentes > 0 ? '2px' : 0 }}
                      title={`${item.mesLabel}: ${item.pendentes} pendentes`}
                    />
                  ) : null}
                </div>
              </div>
              <span className="text-[7px] text-gray-500 sm:text-[8px]">{item.mesLabel}</span>
            </div>
          )
        })}
      </div>
      {total === 0 ? (
        <p className="mt-2 text-center text-xs text-gray-400">Aguardando dados de agendamentos com 7+ dias de antecedência</p>
      ) : null}
    </div>
  )
}
