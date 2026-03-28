'use client'

interface Props {
  dados: { hora: number; total: number }[]
}

export default function HorariosPico({ dados }: Props) {
  const maxTotal = Math.max(...dados.map((d) => d.total), 1)

  if (dados.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-4">
        <h3 className="mb-4 font-bold text-[#001f3f]">⏰ Horários de Pico</h3>
        <div className="flex h-48 items-center justify-center text-gray-500">Nenhum dado disponível</div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="mb-4 font-bold text-[#001f3f]">⏰ Horários de Pico</h3>
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

