'use client'

import { Clock } from 'lucide-react'

interface Props {
  dados: { hora: number; total: number }[]
  semTitulo?: boolean
  embed?: boolean
}

export default function HorariosPico({ dados, semTitulo = false, embed = false }: Props) {
  const maxTotal = Math.max(...dados.map((d) => d.total), 1)
  const wrap = embed ? '' : 'rounded-lg border bg-white p-4'

  if (dados.length === 0) {
    return (
      <div className={wrap}>
        {!semTitulo ? (
          <h3 className="mb-4 flex items-center gap-2 font-bold text-[#001f3f]">
            <Clock className="h-5 w-5 text-[#0097b2]" aria-hidden />
            Horários de pico
          </h3>
        ) : null}
        <div className="flex h-48 items-center justify-center text-gray-500">Nenhum dado disponível</div>
      </div>
    )
  }

  return (
    <div className={wrap}>
      {!semTitulo ? (
        <h3 className="mb-4 flex items-center gap-2 font-bold text-[#001f3f]">
          <Clock className="h-5 w-5 text-[#0097b2]" aria-hidden />
          Horários de pico
        </h3>
      ) : null}
      <div className="space-y-2">
        {dados.map((item) => (
          <div key={item.hora} className="flex items-center gap-3">
            <span className="w-12 text-sm text-gray-600">{item.hora}h</span>
            <div className="h-6 flex-1 overflow-hidden rounded-full bg-gray-100">
              <div
                className="flex h-full items-center justify-end rounded-full bg-[#0097b2] pr-2 text-xs font-bold text-white"
                style={{ width: `${(item.total / maxTotal) * 100}%` }}
              >
                {item.total}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
