'use client'

import { useMemo } from 'react'

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
  /** Rosca (donut) em vez de pizza cheia. */
  rosca?: boolean
  /** Segmento selecionado (destaque visual). */
  selecionado?: string | null
  onSegmentoClick?: (label: string) => void
}

const CORES_PADRAO = ['#0097b2', '#00D443', '#F1C40F', '#E74C3C', '#9B59B6', '#3498DB', '#E67E22', '#1ABC9C']
const COR_ZERO = '#E5E7EB'

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(startAngle: number, endAngle: number, innerR = 0, outerR = 40) {
  const startOuter = polarToCartesian(50, 50, outerR, startAngle)
  const endOuter = polarToCartesian(50, 50, outerR, endAngle)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0

  if (innerR <= 0) {
    return `M 50 50 L ${startOuter.x} ${startOuter.y} A ${outerR} ${outerR} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y} Z`
  }

  const startInner = polarToCartesian(50, 50, innerR, endAngle)
  const endInner = polarToCartesian(50, 50, innerR, startAngle)
  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${endInner.x} ${endInner.y}`,
    'Z',
  ].join(' ')
}

export default function GraficoPizza({
  dados,
  titulo = '',
  semTitulo = false,
  embed = false,
  mostrarComZero = false,
  rosca = false,
  selecionado = null,
  onSegmentoClick,
}: Props) {
  const total = dados.reduce((sum, item) => sum + item.valor, 0)
  const wrap = embed ? 'min-h-[12rem]' : 'min-h-[12rem] rounded-lg border bg-white p-4'

  const segmentos = useMemo(() => {
    if (dados.length === 0) return []

    const usarFatiasIguais = total === 0 && mostrarComZero
    const fatiaPct = usarFatiasIguais ? 100 / dados.length : 0
    let acumulado = 0

    return dados.map((item, i) => {
      const pct = usarFatiasIguais ? fatiaPct : total > 0 ? (item.valor / total) * 100 : 0
      const start = acumulado
      acumulado += pct
      const cor =
        item.cor ??
        (usarFatiasIguais ? COR_ZERO : CORES_PADRAO[i % CORES_PADRAO.length])
      const percentualExibicao = total > 0 ? pct : item.percentual ?? 0
      return {
        ...item,
        percentual: percentualExibicao,
        start,
        end: acumulado,
        cor,
        exibirFatia: usarFatiasIguais || pct > 0,
      }
    })
  }, [dados, mostrarComZero, total])

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

  const temFatias = total > 0 || mostrarComZero
  const innerR = rosca ? 22 : 0

  return (
    <div className={wrap}>
      {!semTitulo && titulo ? <h3 className="mb-4 text-center font-bold text-[#001f3f]">{titulo}</h3> : null}
      <div className="flex flex-col items-center">
        <div className="relative mb-4 h-36 w-36 sm:h-40 sm:w-40">
          {temFatias ? (
            <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label={titulo || 'Gráfico de pizza'}>
              {segmentos.map((seg, i) => {
                if (!seg.exibirFatia) return null
                const startDeg = (seg.start / 100) * 360
                const endDeg = (seg.end / 100) * 360
                const fatiaCheia = seg.percentual >= 99.5

                if (fatiaCheia) {
                  return (
                    <g
                      key={`${seg.label}-${i}`}
                      className={onSegmentoClick ? 'cursor-pointer' : undefined}
                      onClick={onSegmentoClick ? () => onSegmentoClick(seg.label) : undefined}
                    >
                      <circle cx="50" cy="50" r="40" fill={seg.cor} />
                      {innerR > 0 ? <circle cx="50" cy="50" r={innerR} fill="white" /> : null}
                      <title>
                        {seg.label}: {seg.valor.toLocaleString('pt-BR')} ({seg.percentual.toFixed(0)}%)
                      </title>
                    </g>
                  )
                }

                return (
                  <path
                    key={`${seg.label}-${i}`}
                    d={arcPath(startDeg, endDeg, innerR, 40)}
                    fill={seg.cor}
                    stroke={selecionado === seg.label ? '#001f3f' : 'white'}
                    strokeWidth={selecionado === seg.label ? 2 : 1}
                    className={onSegmentoClick ? 'cursor-pointer transition-opacity hover:opacity-80' : undefined}
                    onClick={onSegmentoClick ? () => onSegmentoClick(seg.label) : undefined}
                  >
                    <title>
                      {seg.label}: {seg.valor.toLocaleString('pt-BR')} ({seg.percentual.toFixed(0)}%)
                    </title>
                  </path>
                )
              })}
              {rosca ? (
                <text x="50" y="52" textAnchor="middle" fill="#001f3f" fontSize="9" fontWeight="700">
                  {total.toLocaleString('pt-BR')}
                </text>
              ) : null}
            </svg>
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-full bg-gray-100 text-xs text-gray-400">
              0
            </div>
          )}
        </div>

        <div className="w-full space-y-1.5">
          {segmentos.map((item, i) => {
            const linha = (
              <>
                <div className="flex min-w-0 items-center gap-2">
                  <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.cor }} />
                  <span className="truncate text-xs text-gray-600 sm:text-sm">{item.label}</span>
                </div>
                <span className="shrink-0 text-xs font-medium tabular-nums text-[#001f3f] sm:text-sm">
                  {total > 0 ? `${item.percentual.toFixed(0)}%` : '0%'} ({item.valor.toLocaleString('pt-BR')})
                </span>
              </>
            )
            const cls = `flex w-full items-center justify-between gap-2 rounded px-1 py-0.5 text-left ${
              onSegmentoClick ? 'cursor-pointer hover:bg-gray-50' : ''
            } ${selecionado === item.label ? 'bg-[#0097b2]/10' : ''}`

            return onSegmentoClick ? (
              <button
                key={`${item.label}-${i}`}
                type="button"
                onClick={() => onSegmentoClick(item.label)}
                className={cls}
              >
                {linha}
              </button>
            ) : (
              <div key={`${item.label}-${i}`} className={cls}>
                {linha}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
