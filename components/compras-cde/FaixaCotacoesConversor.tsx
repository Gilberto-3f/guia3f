'use client'

import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  brlPorUnidade,
  converterMoedas,
  type CotacaoMap,
} from '@/lib/comprasCdeHub'

const MOEDAS_ORDEM = ['BRL', 'USD', 'PYG', 'ARS', 'EUR'] as const

const FLAG: Record<string, string> = {
  BRL: '🇧🇷',
  USD: '🇺🇸',
  PYG: '🇵🇾',
  ARS: '🇦🇷',
  EUR: '🇪🇺',
}

const LABEL: Record<string, string> = {
  BRL: 'BRL',
  USD: 'USD',
  PYG: 'PYG',
  ARS: 'ARS',
  EUR: 'EUR',
}

type Props = {
  cotacoes: CotacaoMap
  loading?: boolean
  conversorAberto: boolean
  onToggleConversor: () => void
}

export default function FaixaCotacoesConversor({
  cotacoes,
  loading = false,
  conversorAberto,
  onToggleConversor,
}: Props) {
  const [de, setDe] = useState<string>('USD')
  const [para, setPara] = useState<string>('BRL')
  const [valor, setValor] = useState('100')

  const resultado = useMemo(() => {
    const n = Number(String(valor).replace(',', '.'))
    if (!Number.isFinite(n)) return 0
    return converterMoedas(n, de, para, cotacoes)
  }, [valor, de, para, cotacoes])

  const moedasPara = MOEDAS_ORDEM.filter((m) => m !== de)

  return (
    <div className="space-y-0 border-b border-white/10 bg-[#0088a0]/40">
      <div className="flex items-stretch">
        <div className="min-w-0 flex-1 overflow-x-auto px-2 py-2">
          {loading ? (
            <p className="px-2 text-xs text-white/70">Carregando cotações…</p>
          ) : (
            <div className="flex min-w-max gap-2 sm:gap-3">
              {MOEDAS_ORDEM.map((m) => {
                const brl = brlPorUnidade(m, cotacoes)
                return (
                  <div
                    key={m}
                    className="flex min-w-[4.5rem] flex-col items-center rounded-lg bg-white/10 px-2 py-1.5 text-white"
                  >
                    <span className="text-base leading-none" aria-hidden>
                      {FLAG[m]}
                    </span>
                    <span className="mt-0.5 text-[10px] font-semibold opacity-90">{LABEL[m]}</span>
                    <span className="text-[11px] font-bold tabular-nums">
                      {m === 'BRL' ? 'R$ 1,00' : `R$ ${brl.toFixed(2)}`}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onToggleConversor}
          className="flex shrink-0 items-center border-l border-white/15 px-3 text-white hover:bg-white/10"
          aria-expanded={conversorAberto}
          aria-label={conversorAberto ? 'Fechar conversor' : 'Abrir conversor'}
        >
          <ChevronDown
            className={`h-5 w-5 transition-transform ${conversorAberto ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
      </div>

      {conversorAberto ? (
        <div className="space-y-2 border-t border-white/10 bg-[#007a91]/50 px-3 py-3">
          <p className="text-center text-[11px] font-medium text-white/90">Conversor de moedas</p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[7rem] flex-1 text-[10px] font-semibold uppercase text-white/80">
              De
              <select
                value={de}
                onChange={(e) => {
                  const next = e.target.value
                  setDe(next)
                  if (next === para) setPara(MOEDAS_ORDEM.find((m) => m !== next) ?? 'BRL')
                }}
                className="mt-1 w-full rounded-lg border-0 bg-white px-2 py-2 text-sm text-gray-900"
              >
                {MOEDAS_ORDEM.map((m) => (
                  <option key={m} value={m}>
                    {FLAG[m]} {LABEL[m]}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-[6rem] flex-1 text-[10px] font-semibold uppercase text-white/80">
              Valor
              <input
                type="number"
                min={0}
                step="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="mt-1 w-full rounded-lg border-0 bg-white px-2 py-2 text-sm text-gray-900"
              />
            </label>
            <label className="min-w-[7rem] flex-1 text-[10px] font-semibold uppercase text-white/80">
              Para
              <select
                value={para}
                onChange={(e) => setPara(e.target.value)}
                className="mt-1 w-full rounded-lg border-0 bg-white px-2 py-2 text-sm text-gray-900"
              >
                {moedasPara.map((m) => (
                  <option key={m} value={m}>
                    {FLAG[m]} {LABEL[m]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="rounded-lg bg-white/15 px-3 py-2 text-center text-sm font-bold text-white">
            {FLAG[para]}{' '}
            {para === 'BRL' ? 'R$' : LABEL[para]}{' '}
            {resultado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      ) : null}
    </div>
  )
}
