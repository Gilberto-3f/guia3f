'use client'

import { formatarUsd } from '@/lib/comprasCdeCatalogo'
import type { CotacaoMap } from '@/lib/comprasCdeHub'
import {
  formatarMoedaExibicaoCde,
  usdParaMoedaExibicao,
  useMoedaExibicaoCde,
} from '@/lib/comprasCdeMoedaExibicao'

const VERDE = '#00D443'

type Props = {
  precoUsd: number
  cotacoes: CotacaoMap
  /** Destaque maior no valor em dólar (mini-card). */
  destacarUsd?: boolean
  /** Detalhe do produto: US$ ainda maior. */
  variante?: 'card' | 'detalhe'
  /** Classes no wrapper flex. */
  className?: string
  /** Texto auxiliar após o valor convertido (ex.: cotação do dia). */
  sufixoConvertido?: string
}

/** Preço US$ + conversão com bandeira clicável (BRL → PYG → ARS → EUR). */
export default function PrecoProdutoCde({
  precoUsd,
  cotacoes,
  destacarUsd = false,
  variante = 'card',
  className = '',
  sufixoConvertido,
}: Props) {
  const { moeda, ciclarMoeda, flag, label } = useMoedaExibicaoCde()
  const convertido = usdParaMoedaExibicao(precoUsd, moeda, cotacoes)
  const mostrarConvertido = Number.isFinite(convertido) && convertido > 0

  const usdCls =
    variante === 'detalhe'
      ? 'text-xl'
      : destacarUsd
        ? 'text-base'
        : 'text-sm'

  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${className}`}>
      <p className={`font-bold tabular-nums ${usdCls}`} style={{ color: VERDE }}>
        {formatarUsd(precoUsd)}
      </p>
      {mostrarConvertido ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            ciclarMoeda()
          }}
          className={`inline-flex items-center gap-1 rounded-md px-0.5 font-medium text-black hover:bg-gray-100 ${
            variante === 'detalhe' ? 'text-sm' : 'text-sm'
          }`}
          title={`Moeda: ${label}. Toque para trocar.`}
          aria-label={`Valor em ${label}. Trocar moeda de conversão`}
        >
          <span className="text-base leading-none" aria-hidden>
            {flag}
          </span>
          <span className="tabular-nums">{formatarMoedaExibicaoCde(convertido, moeda)}</span>
          {sufixoConvertido ? (
            <span className="font-normal text-gray-500">{sufixoConvertido}</span>
          ) : null}
        </button>
      ) : null}
    </div>
  )
}
