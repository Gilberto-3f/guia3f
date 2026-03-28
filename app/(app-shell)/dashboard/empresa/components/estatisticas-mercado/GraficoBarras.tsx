'use client'

interface Props {
  dados: { label: string; valor: number; percentual?: number }[]
  titulo: string
  destaque?: string
  destaqueLabel?: string
}

export default function GraficoBarras({ dados, titulo, destaque, destaqueLabel }: Props) {
  const maxValor = Math.max(...dados.map((d) => d.valor), 1)

  if (dados.length === 0 || dados.every((d) => d.valor === 0)) {
    return (
      <div className="rounded-lg border bg-white p-4">
        <h3 className="mb-4 font-bold text-[#001f3f]">{titulo}</h3>
        <div className="flex h-48 items-center justify-center text-gray-500">Nenhum dado disponível no período</div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="mb-4 font-bold text-[#001f3f]">{titulo}</h3>
      <div className="space-y-3">
        {dados.map((item) => (
          <div key={item.label}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="truncate pr-2">{item.label}</span>
              <span className="font-medium text-[#001f3f]">
                {item.valor}
                {item.percentual !== undefined ? ` (${item.percentual.toFixed(0)}%)` : ''}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-200">
              <div
                className={`h-2 rounded-full transition-all ${destaque === item.label ? 'bg-yellow-500' : 'bg-[#0097b2]'}`}
                style={{ width: `${(item.valor / maxValor) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      {destaqueLabel ? <p className="mt-3 text-xs text-gray-500">⚪ {destaqueLabel}</p> : null}
    </div>
  )
}

