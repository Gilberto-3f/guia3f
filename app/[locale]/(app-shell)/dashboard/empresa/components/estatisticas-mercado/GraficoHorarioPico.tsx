'use client'

import { useMemo } from 'react'

interface Props {
  dados: { hora: number; total: number }[]
  semTitulo?: boolean
  embed?: boolean
  mostrarComZero?: boolean
}

export default function GraficoHorarioPico({
  dados,
  semTitulo = false,
  embed = false,
  mostrarComZero = true,
}: Props) {
  const wrap = embed ? 'min-h-[14rem]' : 'min-h-[14rem] rounded-lg border bg-white p-4'

  const horas = useMemo(() => {
    const map = new Map(dados.map((d) => [d.hora, d.total]))
    return Array.from({ length: 24 }, (_, h) => ({ hora: h, total: map.get(h) ?? 0 }))
  }, [dados])

  const total = horas.reduce((s, h) => s + h.total, 0)
  const maxValor = Math.max(...horas.map((h) => h.total), 1)
  const horaPico = horas.reduce((best, h) => (h.total > best.total ? h : best), horas[0])

  if (total === 0 && !mostrarComZero) {
    return (
      <div className={wrap}>
        {!semTitulo ? <h3 className="mb-4 font-bold text-[#001f3f]">Horário de pico</h3> : null}
        <div className="flex h-48 items-center justify-center text-sm text-gray-500">Nenhum dado disponível</div>
      </div>
    )
  }

  return (
    <div className={wrap}>
      {!semTitulo ? <h3 className="mb-4 font-bold text-[#001f3f]">Horário de pico</h3> : null}
      {total > 0 ? (
        <p className="mb-3 text-center text-xs text-gray-500">
          Pico: <span className="font-semibold text-[#001f3f]">{horaPico.hora}h</span> com{' '}
          {horaPico.total.toLocaleString('pt-BR')} atendimentos
        </p>
      ) : (
        <p className="mb-3 text-center text-xs text-gray-400">Aguardando dados de atendimentos concluídos</p>
      )}
      <div className="flex items-end justify-between gap-0.5 sm:gap-1" style={{ minHeight: '10rem' }}>
        {horas.map((item) => {
          const ehPico = total > 0 && item.hora === horaPico.hora && horaPico.total > 0
          const alturaPct = maxValor > 0 ? (item.total / maxValor) * 100 : 0
          return (
            <div key={item.hora} className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
              <span className="text-[8px] font-medium tabular-nums text-[#001f3f] sm:text-[9px]">
                {item.total > 0 ? item.total : ''}
              </span>
              <div className="flex w-full flex-1 items-end justify-center" style={{ height: '8rem' }}>
                <div
                  className={`w-full min-w-[3px] max-w-[1.25rem] rounded-t-sm transition-all ${
                    ehPico ? 'bg-[#E74C3C]' : 'bg-[#0097b2]'
                  }`}
                  style={{ height: `${Math.max(alturaPct, item.total > 0 ? 6 : 2)}%` }}
                  title={`${item.hora}h: ${item.total.toLocaleString('pt-BR')} atendimentos`}
                />
              </div>
              <span className="text-[7px] text-gray-500 sm:text-[8px]">{item.hora}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
