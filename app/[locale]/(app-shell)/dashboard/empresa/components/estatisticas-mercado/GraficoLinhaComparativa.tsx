'use client'

import { useMemo } from 'react'

interface Ponto {
  mesLabel: string
  anoAtual: number
  anoAnterior: number
  diffPercentual?: number
}

interface Props {
  dados: Ponto[]
  unidade?: '%' | 'qtd'
  semTitulo?: boolean
  embed?: boolean
  mostrarComZero?: boolean
  rotuloAtual?: string
  rotuloAnterior?: string
}

function linhaSvg(pontos: { x: number; y: number }[]) {
  return pontos.map((p) => `${p.x},${p.y}`).join(' ')
}

export default function GraficoLinhaComparativa({
  dados,
  unidade = 'qtd',
  semTitulo = false,
  embed = false,
  mostrarComZero = true,
  rotuloAtual = 'Ano atual',
  rotuloAnterior = 'Ano anterior',
}: Props) {
  const wrap = embed ? 'min-h-[14rem]' : 'min-h-[14rem] rounded-lg border bg-white p-4'

  const maxValor = useMemo(
    () => Math.max(...dados.flatMap((d) => [d.anoAtual, d.anoAnterior]), unidade === '%' ? 100 : 1),
    [dados, unidade],
  )

  const vazio = dados.length === 0 || (!mostrarComZero && dados.every((d) => d.anoAtual === 0 && d.anoAnterior === 0))

  if (vazio) {
    return (
      <div className={wrap}>
        <div className="flex h-48 items-center justify-center text-sm text-gray-500">Nenhum dado disponível no período</div>
      </div>
    )
  }

  const denom = Math.max(dados.length - 1, 1)
  const toY = (v: number) => 100 - (v / maxValor) * 80

  const ptsAtual = dados.map((d, i) => ({ x: (i / denom) * 100, y: toY(d.anoAtual) }))
  const ptsAnterior = dados.map((d, i) => ({ x: (i / denom) * 100, y: toY(d.anoAnterior) }))

  const fmt = (v: number) => (unidade === '%' ? `${v.toFixed(1)}%` : v.toLocaleString('pt-BR'))

  return (
    <div className={wrap}>
      {!semTitulo ? <h3 className="mb-3 font-bold text-[#001f3f]">Comparativo</h3> : null}
      <div className="mb-3 flex flex-wrap justify-center gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-[#001f3f]" /> {rotuloAtual}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 border-t-2 border-dashed border-[#0097b2]" /> {rotuloAnterior}
        </span>
      </div>
      <div className="relative h-52">
        <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polyline
            points={linhaSvg(ptsAnterior)}
            fill="none"
            stroke="#0097b2"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            points={linhaSvg(ptsAtual)}
            fill="none"
            stroke="#001f3f"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          {dados.map((d, i) => {
            const cx = (i / denom) * 100
            const cy = toY(d.anoAtual)
            const tooltip = `${d.mesLabel}: ${fmt(d.anoAtual)}${d.diffPercentual != null ? ` (${d.diffPercentual >= 0 ? '+' : ''}${d.diffPercentual.toFixed(0)}% vs ant.)` : ''}`
            return (
              <circle key={i} cx={cx} cy={cy} r="2.5" fill="#001f3f">
                <title>{tooltip}</title>
              </circle>
            )
          })}
        </svg>
        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-0.5 text-[9px] text-gray-500 sm:text-[10px]">
          {dados.map((d, i) => (
            <span key={i} className="truncate">
              {d.mesLabel}
            </span>
          ))}
        </div>
        <div className="absolute left-0 top-0 text-[10px] text-gray-400">{fmt(maxValor)}</div>
        <div className="absolute bottom-6 left-0 text-[10px] text-gray-400">0</div>
      </div>
    </div>
  )
}
