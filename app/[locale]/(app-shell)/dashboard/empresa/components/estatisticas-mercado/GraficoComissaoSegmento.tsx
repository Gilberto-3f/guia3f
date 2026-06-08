'use client'

import { useState } from 'react'

interface ItemComissao {
  label: string
  valor: number
  quantidade: number
  segmento: string
  cor?: string
}

interface Props {
  dados: ItemComissao[]
  mediaEmpresa?: number
  segmentoEmpresa?: string | null
  titulo?: string
  semTitulo?: boolean
  embed?: boolean
}

function formatarMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function GraficoComissaoSegmento({
  dados,
  mediaEmpresa = 0,
  segmentoEmpresa = null,
  titulo = '',
  semTitulo = false,
  embed = false,
}: Props) {
  const [tooltip, setTooltip] = useState<string | null>(null)
  const maxValor = Math.max(...dados.map((d) => d.valor), mediaEmpresa, 1)
  const wrap = embed ? '' : 'rounded-lg border bg-white p-4'

  return (
    <div className={wrap}>
      {!semTitulo && titulo ? <h3 className="mb-4 text-center font-bold text-[#001f3f]">{titulo}</h3> : null}
      <div className="relative space-y-3 pb-1">
        {dados.map((item, i) => {
          const larguraPct = maxValor > 0 ? (item.valor / maxValor) * 100 : 0
          const refPct = maxValor > 0 && mediaEmpresa > 0 ? (mediaEmpresa / maxValor) * 100 : 0
          const ehEmpresa = segmentoEmpresa != null && item.segmento === segmentoEmpresa
          const cor = ehEmpresa ? '#F1C40F' : item.cor ?? '#0097b2'
          const tip = `${item.label} — Média: ${formatarMoeda(item.valor)} — Total de comissões: ${item.quantidade.toLocaleString('pt-BR')}`

          return (
            <div key={`${item.label}-${i}`}>
              <div className="mb-1 flex justify-between gap-2 text-xs sm:text-sm">
                <span className="truncate text-gray-700">{item.label}</span>
                <span className="shrink-0 font-medium tabular-nums text-[#001f3f]">{formatarMoeda(item.valor)}</span>
              </div>
              <div className="relative h-3 w-full rounded-full bg-gray-100">
                {mediaEmpresa > 0 ? (
                  <span
                    className="pointer-events-none absolute top-0 z-10 h-full w-0.5 bg-[#F1C40F]"
                    style={{ left: `${Math.min(refPct, 100)}%` }}
                    aria-hidden
                  />
                ) : null}
                <div
                  className="relative h-3 rounded-full transition-all"
                  style={{ width: `${Math.max(larguraPct, item.valor > 0 ? 2 : 0)}%`, backgroundColor: cor }}
                  onMouseEnter={() => setTooltip(tip)}
                  onMouseLeave={() => setTooltip(null)}
                  onFocus={() => setTooltip(tip)}
                  onBlur={() => setTooltip(null)}
                  tabIndex={0}
                  role="img"
                  aria-label={tip}
                />
              </div>
            </div>
          )
        })}
      </div>

      {mediaEmpresa > 0 ? (
        <p className="mt-3 text-center text-xs text-gray-500">
          Marcador amarelo: sua média de comissão ({formatarMoeda(mediaEmpresa)})
        </p>
      ) : null}

      {tooltip ? (
        <p className="mt-2 rounded-md bg-gray-50 px-3 py-2 text-center text-xs text-gray-600">{tooltip}</p>
      ) : null}
    </div>
  )
}
