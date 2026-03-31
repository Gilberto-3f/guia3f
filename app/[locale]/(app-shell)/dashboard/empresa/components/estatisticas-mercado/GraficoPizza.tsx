'use client'

interface Props {
  dados: { label: string; valor: number; percentual: number }[]
  titulo: string
}

const CORES = ['#0097b2', '#00D443', '#F1C40F', '#E74C3C', '#9B59B6', '#3498DB', '#E67E22', '#1ABC9C']

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(startAngle: number, endAngle: number) {
  const r = 40
  const start = polarToCartesian(50, 50, r, startAngle)
  const end = polarToCartesian(50, 50, r, endAngle)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return `M 50 50 L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`
}

export default function GraficoPizza({ dados, titulo }: Props) {
  const total = dados.reduce((sum, item) => sum + item.valor, 0)

  if (dados.length === 0 || total === 0) {
    return (
      <div className="rounded-lg border bg-white p-4">
        <h3 className="mb-4 font-bold text-[#001f3f]">{titulo}</h3>
        <div className="flex h-48 items-center justify-center text-gray-500">Nenhum dado disponível no período</div>
      </div>
    )
  }

  let acumulado = 0
  const segmentos = dados.map((item) => {
    const pct = (item.valor / total) * 100
    const start = acumulado
    acumulado += pct
    return { ...item, percentual: pct, start, end: acumulado }
  })

  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="mb-4 font-bold text-[#001f3f]">{titulo}</h3>
      <div className="flex flex-col items-center">
        <div className="relative mb-4 h-40 w-40 overflow-hidden rounded-full">
          <svg viewBox="0 0 100 100" className="h-full w-full">
            {segmentos.map((seg, i) => (
              <path
                key={`${seg.label}-${i}`}
                d={arcPath((seg.start / 100) * 360, (seg.end / 100) * 360)}
                fill={CORES[i % CORES.length]}
              />
            ))}
          </svg>
        </div>

        <div className="w-full space-y-2">
          {segmentos.map((item, i) => (
            <div key={`${item.label}-${i}`} className="flex items-center justify-between">
              <div className="flex min-w-0 items-center gap-2">
                <div className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: CORES[i % CORES.length] }} />
                <span className="truncate text-sm text-gray-600">{item.label}</span>
              </div>
              <span className="shrink-0 text-sm font-medium text-[#001f3f]">
                {item.percentual.toFixed(0)}% ({item.valor})
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

