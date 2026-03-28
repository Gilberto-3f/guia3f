'use client'

interface Props {
  dados: { mes: string; valor: number }[]
  titulo: string
  cor?: string
}

export default function GraficoLinha({ dados, titulo, cor = '#0097b2' }: Props) {
  const maxValor = Math.max(...dados.map((d) => d.valor), 1)

  if (dados.length === 0 || dados.every((d) => d.valor === 0)) {
    return (
      <div className="rounded-lg border bg-white p-4">
        <h3 className="mb-4 font-bold text-[#001f3f]">{titulo}</h3>
        <div className="flex h-48 items-center justify-center text-gray-500">Nenhum dado disponível no período</div>
      </div>
    )
  }

  const denom = Math.max(dados.length - 1, 1)
  const points = dados
    .map((d, i) => {
      const x = (i / denom) * 100
      const y = 100 - (d.valor / maxValor) * 80
      return `${x},${y}`
    })
    .join(' ')

  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="mb-4 font-bold text-[#001f3f]">{titulo}</h3>
      <div className="relative h-48">
        <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polyline points={points} fill="none" stroke={cor} strokeWidth="2" />
          {dados.map((d, i) => {
            const cx = (i / denom) * 100
            const cy = 100 - (d.valor / maxValor) * 80
            return <circle key={i} cx={cx} cy={cy} r="2" fill={cor} />
          })}
        </svg>

        <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-gray-500">
          {dados.map((d, i) => (
            <span key={i}>{d.mes}</span>
          ))}
        </div>
        <div className="absolute left-0 top-0 text-xs text-gray-500">{maxValor}</div>
      </div>
    </div>
  )
}

