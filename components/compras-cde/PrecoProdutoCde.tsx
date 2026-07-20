'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CotacaoMap } from '@/lib/comprasCdeHub'
import {
  flagLabelConversor,
  formatarMoedaConversor,
  formatarPrecoMoedaPadrao,
  moedasConversorSemPadrao,
  normalizarMoedaPadrao,
  usdParaMoedaConversor,
  usdParaMoedaPadrao,
  type MoedaConversorPool,
  type MoedaPadraoLoja,
} from '@/lib/comprasCdeMoedaPadrao'

const VERDE = '#00D443'
const STORAGE_KEY = 'compras-cde-moeda-exibicao'
const EVENTO = 'compras-cde-moeda-exibicao'

function isMoedaConversor(v: string, pool: MoedaConversorPool[]): v is MoedaConversorPool {
  return pool.includes(v as MoedaConversorPool)
}

function lerPreferenciaConversor(pool: MoedaConversorPool[]): MoedaConversorPool {
  const fallback = pool[0] ?? 'BRL'
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw && isMoedaConversor(raw, pool)) return raw
  } catch {
    /* ignore */
  }
  return fallback
}

function gravarPreferenciaConversor(moeda: MoedaConversorPool) {
  try {
    localStorage.setItem(STORAGE_KEY, moeda)
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENTO, { detail: moeda }))
  }
}

function useMoedaConversor(moedaPadrao: MoedaPadraoLoja) {
  const pool = useMemo(() => moedasConversorSemPadrao(moedaPadrao), [moedaPadrao])
  const [moeda, setMoeda] = useState<MoedaConversorPool>(() => pool[0] ?? 'BRL')

  useEffect(() => {
    setMoeda(lerPreferenciaConversor(pool))
    const sync = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail
      if (detail && isMoedaConversor(detail, pool)) setMoeda(detail)
      else setMoeda(lerPreferenciaConversor(pool))
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setMoeda(lerPreferenciaConversor(pool))
    }
    window.addEventListener(EVENTO, sync)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(EVENTO, sync)
      window.removeEventListener('storage', onStorage)
    }
  }, [pool])

  useEffect(() => {
    if (!pool.includes(moeda)) {
      const next = lerPreferenciaConversor(pool)
      setMoeda(next)
    }
  }, [pool, moeda])

  const ciclarMoeda = useCallback(() => {
    setMoeda((atual) => {
      const i = pool.indexOf(atual)
      const next = pool[(i >= 0 ? i + 1 : 0) % pool.length] ?? pool[0]
      if (next) gravarPreferenciaConversor(next)
      return next ?? atual
    })
  }, [pool])

  const { flag, label } = flagLabelConversor(moeda)
  return { moeda, ciclarMoeda, flag, label, pool }
}

type Props = {
  precoUsd: number
  cotacoes: CotacaoMap
  /** Moeda padrão da loja — destaque principal nos cards. */
  moedaPadrao?: MoedaPadraoLoja | string | null
  /** @deprecated Mantido por compatibilidade; o destaque agora segue moedaPadrao. */
  destacarUsd?: boolean
  /** Detalhe do produto: valor principal maior. */
  variante?: 'card' | 'detalhe'
  /** Classes no wrapper flex. */
  className?: string
  /** Texto auxiliar após o valor convertido (ex.: cotação do dia). */
  sufixoConvertido?: string
}

/** Preço na moeda padrão + conversão com bandeira clicável (demais moedas). */
export default function PrecoProdutoCde({
  precoUsd,
  cotacoes,
  moedaPadrao: moedaPadraoProp = 'USD',
  destacarUsd = false,
  variante = 'card',
  className = '',
  sufixoConvertido,
}: Props) {
  const moedaPadrao = normalizarMoedaPadrao(moedaPadraoProp)
  const { moeda, ciclarMoeda, flag, label, pool } = useMoedaConversor(moedaPadrao)

  const destaque = usdParaMoedaPadrao(precoUsd, moedaPadrao, cotacoes)
  const convertido = usdParaMoedaConversor(precoUsd, moeda, cotacoes)
  const mostrarConvertido =
    pool.length > 0 && Number.isFinite(convertido) && convertido > 0

  const destaqueCls =
    variante === 'detalhe' ? 'text-xl' : destacarUsd ? 'text-base' : 'text-sm'

  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${className}`}>
      <p className={`font-bold tabular-nums ${destaqueCls}`} style={{ color: VERDE }}>
        {formatarPrecoMoedaPadrao(destaque, moedaPadrao)}
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
          <span className="tabular-nums">{formatarMoedaConversor(convertido, moeda)}</span>
          {sufixoConvertido ? (
            <span className="font-normal text-gray-500">{sufixoConvertido}</span>
          ) : null}
        </button>
      ) : null}
    </div>
  )
}
