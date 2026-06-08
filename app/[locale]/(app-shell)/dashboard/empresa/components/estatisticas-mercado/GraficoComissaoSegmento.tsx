'use client'

import { useState } from 'react'
import type { ComissaoEmpresaResumo } from '@/lib/estatisticasMercadoAnalise'

interface ItemComissao {
  label: string
  mediaPax: number
  mediaPercentual: number
  mediaIndicacao: number
  quantidade: number
  segmento: string
  cor?: string
}

interface Props {
  dados: ItemComissao[]
  comissaoEmpresa?: ComissaoEmpresaResumo
  segmentoEmpresa?: string | null
  titulo?: string
  semTitulo?: boolean
  embed?: boolean
}

function formatarMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarPercentual(v: number) {
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

type TipoMetrica = 'pax' | 'percentual' | 'indicacao'

const METRICAS: { tipo: TipoMetrica; rotulo: string; formatar: (v: number) => string }[] = [
  { tipo: 'pax', rotulo: 'PAX', formatar: formatarMoeda },
  { tipo: 'percentual', rotulo: 'Porcentagem', formatar: formatarPercentual },
  { tipo: 'indicacao', rotulo: 'Indicação', formatar: formatarMoeda },
]

function valorMetrica(item: ItemComissao, tipo: TipoMetrica) {
  if (tipo === 'pax') return item.mediaPax
  if (tipo === 'percentual') return item.mediaPercentual
  return item.mediaIndicacao
}

function valorEmpresa(comissao: ComissaoEmpresaResumo, tipo: TipoMetrica) {
  if (tipo === 'pax') return comissao.mediaPax
  if (tipo === 'percentual') return comissao.mediaPercentual
  return comissao.mediaIndicacao
}

export default function GraficoComissaoSegmento({
  dados,
  comissaoEmpresa = { mediaPax: 0, mediaPercentual: 0, mediaIndicacao: 0, quantidade: 0 },
  segmentoEmpresa = null,
  titulo = '',
  semTitulo = false,
  embed = false,
}: Props) {
  const [tooltip, setTooltip] = useState<string | null>(null)
  const maxValor = Math.max(
    ...dados.flatMap((d) => [d.mediaPax, d.mediaPercentual, d.mediaIndicacao]),
    comissaoEmpresa.mediaPax,
    comissaoEmpresa.mediaPercentual,
    comissaoEmpresa.mediaIndicacao,
    1,
  )
  const wrap = embed ? '' : 'rounded-lg border bg-white p-4'
  const temComissaoEmpresa =
    comissaoEmpresa.mediaPax > 0 ||
    comissaoEmpresa.mediaPercentual > 0 ||
    comissaoEmpresa.mediaIndicacao > 0

  return (
    <div className={wrap}>
      {!semTitulo && titulo ? <h3 className="mb-4 text-center font-bold text-[#001f3f]">{titulo}</h3> : null}
      <div className="relative space-y-4 pb-1">
        {dados.map((item, i) => {
          const ehEmpresa = segmentoEmpresa != null && item.segmento === segmentoEmpresa
          const cor = ehEmpresa ? '#F1C40F' : item.cor ?? '#0097b2'

          return (
            <div key={`${item.label}-${i}`} className="rounded-lg border border-gray-100 bg-gray-50/50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-[#001f3f]">{item.label}</span>
                <span className="text-[11px] text-gray-400">
                  {item.quantidade.toLocaleString('pt-BR')} oferta{item.quantidade === 1 ? '' : 's'}
                </span>
              </div>
              <div className="space-y-2">
                {METRICAS.map(({ tipo, rotulo, formatar }) => {
                  const valor = valorMetrica(item, tipo)
                  const refEmpresa = valorEmpresa(comissaoEmpresa, tipo)
                  const larguraPct = maxValor > 0 ? (valor / maxValor) * 100 : 0
                  const refPct = maxValor > 0 && refEmpresa > 0 && ehEmpresa ? (refEmpresa / maxValor) * 100 : 0
                  const tip = `${item.label} — ${rotulo}: ${formatar(valor)} — ${item.quantidade} oferta(s) no segmento`

                  return (
                    <div key={tipo}>
                      <div className="mb-0.5 flex justify-between gap-2 text-xs">
                        <span className="text-gray-600">{rotulo}</span>
                        <span className="shrink-0 font-medium tabular-nums text-[#001f3f]">{formatar(valor)}</span>
                      </div>
                      <div className="relative h-2 w-full rounded-full bg-gray-100">
                        {ehEmpresa && temComissaoEmpresa && refEmpresa > 0 ? (
                          <span
                            className="pointer-events-none absolute top-0 z-10 h-full w-0.5 bg-[#F1C40F]"
                            style={{ left: `${Math.min(refPct, 100)}%` }}
                            aria-hidden
                          />
                        ) : null}
                        <div
                          className="relative h-2 rounded-full transition-all"
                          style={{
                            width: `${Math.max(larguraPct, valor > 0 ? 2 : 0)}%`,
                            backgroundColor: cor,
                          }}
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
            </div>
          )
        })}
      </div>

      {temComissaoEmpresa && segmentoEmpresa ? (
        <p className="mt-3 text-center text-xs text-gray-500">
          Marcador amarelo: suas ofertas cadastradas no segmento da sua empresa
        </p>
      ) : null}

      {tooltip ? (
        <p className="mt-2 rounded-md bg-gray-50 px-3 py-2 text-center text-xs text-gray-600">{tooltip}</p>
      ) : null}
    </div>
  )
}
