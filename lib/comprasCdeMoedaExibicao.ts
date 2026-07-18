'use client'

import { useCallback, useEffect, useState } from 'react'
import { converterMoedas, type CotacaoMap } from '@/lib/comprasCdeHub'

export const MOEDAS_EXIBICAO_CDE = ['BRL', 'PYG', 'ARS', 'EUR'] as const
export type MoedaExibicaoCde = (typeof MOEDAS_EXIBICAO_CDE)[number]

const STORAGE_KEY = 'compras-cde-moeda-exibicao'
const EVENTO = 'compras-cde-moeda-exibicao'

export const FLAG_MOEDA_CDE: Record<MoedaExibicaoCde, string> = {
  BRL: '🇧🇷',
  PYG: '🇵🇾',
  ARS: '🇦🇷',
  EUR: '🇪🇺',
}

export const LABEL_MOEDA_CDE: Record<MoedaExibicaoCde, string> = {
  BRL: 'Real',
  PYG: 'Guarani',
  ARS: 'Peso argentino',
  EUR: 'Euro',
}

function isMoedaExibicao(v: string): v is MoedaExibicaoCde {
  return (MOEDAS_EXIBICAO_CDE as readonly string[]).includes(v)
}

export function lerMoedaExibicaoCde(): MoedaExibicaoCde {
  if (typeof window === 'undefined') return 'BRL'
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw && isMoedaExibicao(raw)) return raw
  } catch {
    /* ignore */
  }
  return 'BRL'
}

export function gravarMoedaExibicaoCde(moeda: MoedaExibicaoCde) {
  try {
    localStorage.setItem(STORAGE_KEY, moeda)
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENTO, { detail: moeda }))
  }
}

export function proximaMoedaExibicaoCde(atual: MoedaExibicaoCde): MoedaExibicaoCde {
  const i = MOEDAS_EXIBICAO_CDE.indexOf(atual)
  return MOEDAS_EXIBICAO_CDE[(i + 1) % MOEDAS_EXIBICAO_CDE.length]
}

/** Formata valor já convertido na moeda de exibição. */
export function formatarMoedaExibicaoCde(valor: number, moeda: MoedaExibicaoCde): string {
  const v = Math.max(0, Number(valor) || 0)
  if (moeda === 'PYG') {
    return `₲ ${Math.round(v).toLocaleString('pt-BR')}`
  }
  if (moeda === 'ARS') {
    return `AR$ ${v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  if (moeda === 'EUR') {
    return `€ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** USD → moeda de preferência do visitante. */
export function usdParaMoedaExibicao(
  usd: number,
  moeda: MoedaExibicaoCde,
  cotacoes: CotacaoMap,
): number {
  return converterMoedas(usd, 'USD', moeda, cotacoes)
}

/** Preferência de moeda convertida (bandeira) — sincroniza hub + drawer. */
export function useMoedaExibicaoCde() {
  const [moeda, setMoeda] = useState<MoedaExibicaoCde>('BRL')

  useEffect(() => {
    setMoeda(lerMoedaExibicaoCde())
    const sync = (e: Event) => {
      const detail = (e as CustomEvent<MoedaExibicaoCde>).detail
      if (detail && isMoedaExibicao(detail)) setMoeda(detail)
      else setMoeda(lerMoedaExibicaoCde())
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setMoeda(lerMoedaExibicaoCde())
    }
    window.addEventListener(EVENTO, sync)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(EVENTO, sync)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const ciclarMoeda = useCallback(() => {
    setMoeda((atual) => {
      const next = proximaMoedaExibicaoCde(atual)
      gravarMoedaExibicaoCde(next)
      return next
    })
  }, [])

  return { moeda, ciclarMoeda, flag: FLAG_MOEDA_CDE[moeda], label: LABEL_MOEDA_CDE[moeda] }
}
