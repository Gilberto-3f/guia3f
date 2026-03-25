'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, ShoppingBag } from 'lucide-react'
import { supabase } from '@/lib/supabase'

/**
 * @param {{
 *   produto: {
 *     id: string
 *     nome: string
 *     preco_brl: number
 *     preco_usd: number
 *     preco_ars: number
 *     preco_pyg: number
 *     preco_eur: number
 *     empresa_nome: string
 *   }
 *   onComprar?: () => void
 * }} props
 */
export default function ComparadorPrecos({ produto, onComprar }) {
  /** @type {Record<string, number>} */
  const [taxas, setTaxas] = useState({
    USD: 0.2,
    EUR: 0.18,
    ARS: 180,
    PYG: 1500,
  })

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from('cotacoes').select('moeda, valor_brl')
      if (error || !data?.length) return
      const next = {
        USD: 0.2,
        EUR: 0.18,
        ARS: 180,
        PYG: 1500,
      }
      for (const row of data) {
        const v = Number(row.valor_brl)
        if (row.moeda && Number.isFinite(v) && v > 0) next[row.moeda] = v
      }
      setTaxas(next)
    }
    void load()
  }, [])

  const [moedaSelecionada, setMoedaSelecionada] = useState(/** @type {'brl' | 'usd' | 'ars' | 'pyg' | 'eur'} */ ('pyg'))

  const moedas = /** @type {const} */ ({
    brl: { simbolo: 'R$', nome: 'Real', key: null },
    usd: { simbolo: 'US$', nome: 'Dólar', key: 'USD' },
    ars: { simbolo: 'ARS$', nome: 'Peso Argentino', key: 'ARS' },
    pyg: { simbolo: '₲', nome: 'Guarani', key: 'PYG' },
    eur: { simbolo: '€', nome: 'Euro', key: 'EUR' },
  })

  const precoBRL = Math.max(0, Number(produto.preco_brl) || 0)

  const precoCampo = () => {
    switch (moedaSelecionada) {
      case 'brl':
        return precoBRL
      case 'usd':
        return Math.max(0, Number(produto.preco_usd) || 0)
      case 'ars':
        return Math.max(0, Number(produto.preco_ars) || 0)
      case 'pyg':
        return Math.max(0, Number(produto.preco_pyg) || 0)
      case 'eur':
        return Math.max(0, Number(produto.preco_eur) || 0)
      default:
        return 0
    }
  }

  const precoParaguai = precoCampo()

  /** Preço na moeda selecionada convertido para BRL (referência) */
  const precoEmBRLReferencia = () => {
    if (moedaSelecionada === 'brl') return precoBRL
    const key = moedas[moedaSelecionada].key
    if (!key || !taxas[key]) return precoParaguai
    return precoParaguai / taxas[key]
  }

  const referenciaBRL = precoEmBRLReferencia()
  const economia = precoBRL - referenciaBRL
  const percentual = precoBRL > 0 ? (economia / precoBRL) * 100 : 0
  const atualExibicao = moedaSelecionada === 'brl' ? precoBRL : precoParaguai

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <h3 className="mb-3 font-semibold text-gray-800">Comparador de preços</h3>

      <div className="mb-4 flex flex-wrap gap-2">
        {/** @type {(keyof typeof moedas)[]} */ (
          ['brl', 'pyg', 'usd', 'ars', 'eur']
        ).map((key) => {
          const m = moedas[key]
          return (
            <button
              key={key}
              type="button"
              onClick={() => setMoedaSelecionada(key)}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                moedaSelecionada === key
                  ? 'bg-[#0097b2] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {m.simbolo} {m.nome}
            </button>
          )
        })}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-gray-600">Preço (loja)</span>
          <span className="text-xl font-bold text-[#0097b2]">
            {moedas[moedaSelecionada].simbolo} {atualExibicao.toFixed(2)}
          </span>
        </div>

        {moedaSelecionada !== 'brl' ? (
          <>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-600">Equivalente em BRL</span>
              <span className="flex items-center gap-1 text-gray-700">
                R$ {referenciaBRL.toFixed(2)}
                <ArrowRight size={14} className="text-gray-400" aria-hidden />
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-gray-600">Preço BRL cadastrado</span>
              <span className="text-gray-500">R$ {precoBRL.toFixed(2)}</span>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className="text-gray-600">Preço em reais</span>
            <span className="font-medium text-gray-800">R$ {precoBRL.toFixed(2)}</span>
          </div>
        )}

        {economia > 0 ? (
          <div className="rounded-lg bg-green-50 p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-green-700">Economia estimada</span>
              <span className="font-bold text-green-700">
                R$ {economia.toFixed(2)} ({percentual.toFixed(0)}%)
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-amber-50 p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-amber-800">Preço similar ou maior na conversão</span>
              <span className="text-amber-800">Δ R$ {Math.abs(economia).toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onComprar}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#0097b2] py-2 font-medium text-white transition-colors hover:bg-[#007a91]"
      >
        <ShoppingBag size={18} aria-hidden />
        Comprar em {produto.empresa_nome}
      </button>
    </div>
  )
}
