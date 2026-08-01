'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { carregarCotacoesMap, converterMoedas, type CotacaoMap } from '@/lib/comprasCdeHub'
import {
  FLAG_MOEDA_PADRAO,
  LABEL_MOEDA_PADRAO,
  formatarPrecoMoedaPadrao,
  type MoedaPadraoLoja,
} from '@/lib/comprasCdeMoedaPadrao'

const POOL: MoedaPadraoLoja[] = ['BRL', 'USD', 'PYG', 'ARS']

type Props = {
  valorBrl: number
  className?: string
}

/**
 * Valor tabelado em BRL com toque para ciclar cotação (estilo mini-card Compras CDE).
 */
export default function CotacaoValorMobilidade({ valorBrl, className = '' }: Props) {
  const [cotacoes, setCotacoes] = useState<CotacaoMap>({})
  const [moeda, setMoeda] = useState<MoedaPadraoLoja>('BRL')

  useEffect(() => {
    let ativo = true
    void carregarCotacoesMap(supabase).then((m) => {
      if (ativo) setCotacoes(m)
    })
    return () => {
      ativo = false
    }
  }, [])

  const ciclar = useCallback(() => {
    setMoeda((atual) => {
      const i = POOL.indexOf(atual)
      return POOL[(i + 1) % POOL.length] ?? 'BRL'
    })
  }, [])

  if (!Number.isFinite(valorBrl) || valorBrl <= 0) return null

  const convertido =
    moeda === 'BRL' ? valorBrl : converterMoedas(valorBrl, 'BRL', moeda, cotacoes)
  const flag = FLAG_MOEDA_PADRAO[moeda]
  const label = LABEL_MOEDA_PADRAO[moeda]

  return (
    <button
      type="button"
      onClick={ciclar}
      className={`inline-flex flex-wrap items-baseline gap-1.5 text-left ${className}`}
      title="Toque para ver em outra moeda"
    >
      <span className="text-lg font-bold" style={{ color: '#0097b2' }}>
        {formatarPrecoMoedaPadrao(convertido, moeda)}
      </span>
      <span className="text-xs font-semibold text-[#0097b2]">
        {flag} {label}
      </span>
      {moeda !== 'BRL' ? (
        <span className="w-full text-[10px] text-gray-400">
          ≈ {formatarPrecoMoedaPadrao(valorBrl, 'BRL')} · cotação do dia
        </span>
      ) : (
        <span className="w-full text-[10px] text-gray-400">Toque para ver outras moedas</span>
      )}
    </button>
  )
}
