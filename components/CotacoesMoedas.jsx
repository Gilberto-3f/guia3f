'use client'

import { useEffect, useState } from 'react'
import { DollarSign, Euro, Coins, TrendingUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'

/** @typedef {{ moeda: string, valor_brl: number, simbolo?: string, nome?: string, Icon?: typeof DollarSign }} CotacaoFmt */

const MAP_MOEDAS = {
  USD: { simbolo: 'US$', nome: 'Dólar', Icon: DollarSign },
  EUR: { simbolo: '€', nome: 'Euro', Icon: Euro },
  ARS: { simbolo: 'ARS$', nome: 'Peso Argentino', Icon: Coins },
  PYG: { simbolo: '₲', nome: 'Guarani', Icon: TrendingUp },
}

export default function CotacoesMoedas() {
  const [cotacoes, setCotacoes] = useState(/** @type {CotacaoFmt[]} */ ([]))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const carregarCotacoes = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase.from('cotacoes').select('moeda, valor_brl').order('moeda')

        if (error) throw error

        const formatadas =
          data?.map((c) => {
            const extra = MAP_MOEDAS[/** @type {keyof typeof MAP_MOEDAS} */ (c.moeda)] || {
              simbolo: c.moeda,
              nome: c.moeda,
              Icon: Coins,
            }
            return {
              moeda: c.moeda,
              valor_brl: Number(c.valor_brl) || 0,
              ...extra,
            }
          }) ?? []

        setCotacoes(formatadas)
      } catch (e) {
        console.error('Erro ao carregar cotações:', e)
      } finally {
        setLoading(false)
      }
    }

    void carregarCotacoes()
  }, [])

  if (loading) {
    return (
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <div className="animate-pulse text-gray-400">Carregando cotações...</div>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-medium text-gray-600">Cotações do dia</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {cotacoes.map((cot) => {
          const Icon = cot.Icon || Coins
          return (
            <div key={cot.moeda} className="flex items-center justify-between gap-2 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <Icon size={16} className="shrink-0 text-gray-400" aria-hidden />
                <span className="truncate text-gray-600">{cot.nome}</span>
              </div>
              <div className="shrink-0 text-right">
                <span className="font-medium">
                  {cot.simbolo} {cot.valor_brl.toFixed(2)}
                </span>
                <span className="ml-1 text-xs text-gray-400">= R$ 1</span>
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-center text-xs text-gray-400">Cotações para referência — atualize conforme sua API</p>
    </div>
  )
}
