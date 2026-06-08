'use client'

interface ItemPizza {
  label: string
  valor: number
  percentual: number
  cor?: string
}

interface Props {
  dados: ItemPizza[]
  titulo?: string
  semTitulo?: boolean
  embed?: boolean
  /** Exibe legenda mesmo quando todos os valores são zero. */
  mostrarComZero?: boolean
}

const CORES_PADRAO = ['#0097b2', '#00D443', '#F1C40F', '#E74C3C', '#9B59B6', '#3498DB', '#E67E22', '#1ABC9C']

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

export default function GraficoPizza({
  dados,
  titulo = '',
  semTitulo = false,
  embed = false,
  mostrarComZero = false,
}: Props) {
  const total = dados.reduce((sum, item) => sum + item.valor, 0)
  const wrap = embed ? '' : 'rounded-lg border bg-white p-4'

  if (dados.length === 0 || (total === 0 && !mostrarComZero)) {
    return (
      <div className={wrap}>
        {!semTitulo && titulo ? <h3 className="mb-4 text-center font-bold text-[#001f3f]">{titulo}</h3> : null}
        <div className="flex h-40 items-center justify-center text-sm text-gray-500">
          Nenhum dado disponível no período
        </div>
      </div>
    )
  }

  let acumulado = 0
  const segmentos = dados.map((item, i) => {
    const pct = total > 0 ? (item.valor / total) * 100 : 0
    const start = acumulado
    acumulado += pct
    const cor = item.cor ?? CORES_PADRAO[i % CORES_PADRAO.length]
    return { ...item, percentual: pct, start, end: acumulado, cor }
  })

  const temFatias = total > 0

  return (
    <div className={wrap}>
      {!semTitulo && titulo ? <h3 className="mb-4 text-center font-bold text-[#001f3f]">{titulo}</h3> : null}
      <div className="flex flex-col items-center">
        <div className="relative mb-4 h-36 w-36 overflow-hidden rounded-full sm:h-40 sm:w-40">
          {temFatias ? (
            <svg viewBox="0 0 100 100" className="h-full w-full">
              {segmentos.map((seg, i) =>
                seg.percentual > 0 ? (
                  <path
                    key={`${seg.label}-${i}`}
                    d={arcPath((seg.start / 100) * 360, (seg.end / 100) * 360)}
                    fill={seg.cor}
                  />
                ) : null,
              )}
            </svg>
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-full bg-gray-100 text-xs text-gray-400">
              0
            </div>
          )}
        </div>

        <div className="w-full space-y-1.5">
          {segmentos.map((item, i) => (
            <div key={`${item.label}-${i}`} className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.cor }} />
                <span className="truncate text-xs text-gray-600 sm:text-sm">{item.label}</span>
              </div>
              <span className="shrink-0 text-xs font-medium tabular-nums text-[#001f3f] sm:text-sm">
                {total > 0 ? `${item.percentual.toFixed(0)}%` : '0%'} ({item.valor.toLocaleString('pt-BR')})
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
