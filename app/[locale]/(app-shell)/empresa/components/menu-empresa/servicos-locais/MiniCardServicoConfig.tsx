'use client'

import { Pencil, Trash2 } from 'lucide-react'
import { precoFinalUsd, type ServicoLocalRow } from '@/lib/servicosLocaisCatalogo'
import type { CotacaoMap } from '@/lib/comprasCdeHub'
import {
  formatarPrecoMoedaPadrao,
  usdParaMoedaPadrao,
  type MoedaPadraoLoja,
} from '@/lib/comprasCdeMoedaPadrao'

type Props = {
  item: ServicoLocalRow
  onEditar: () => void
  onExcluir: () => void
  excluindo?: boolean
  moedaPadrao?: MoedaPadraoLoja
  cotacoes?: CotacaoMap
}

export default function MiniCardServicoConfig({
  item,
  onEditar,
  onExcluir,
  excluindo = false,
  moedaPadrao = 'USD',
  cotacoes,
}: Props) {
  const capa = item.fotos[0] ?? item.foto_url
  const pct = Number(item.percentual_desconto) || 0
  const finalUsd = precoFinalUsd(item.preco_usd, pct)
  const map: CotacaoMap = cotacoes ?? { USD: 0.2, EUR: 0.18, ARS: 180, PYG: 1500 }
  const finalExibicao = usdParaMoedaPadrao(finalUsd, moedaPadrao, map)
  const cheioExibicao = pct > 0 ? usdParaMoedaPadrao(item.preco_usd, moedaPadrao, map) : null

  return (
    <article className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex gap-3 p-3">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-100">
          {capa ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={capa} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">
              Sem foto
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[#001f3f]">{item.nome}</p>
          {item.categoria_nome ? (
            <p className="mt-0.5 truncate text-xs text-gray-500">{item.categoria_nome}</p>
          ) : null}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {cheioExibicao != null ? (
              <p className="text-xs tabular-nums text-gray-400 line-through">
                {formatarPrecoMoedaPadrao(cheioExibicao, moedaPadrao)}
              </p>
            ) : null}
            <p className="text-sm font-bold text-[#00D443]">
              {formatarPrecoMoedaPadrao(finalExibicao, moedaPadrao)}
            </p>
            {pct > 0 ? (
              <span className="rounded bg-[#00D443]/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#00D443]">
                Em oferta −{pct}%
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex border-t border-gray-100">
        <button
          type="button"
          onClick={onEditar}
          className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-[#0097b2] hover:bg-[#0097b2]/5"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
          Editar
        </button>
        <button
          type="button"
          onClick={onExcluir}
          disabled={excluindo}
          className="flex flex-1 items-center justify-center gap-1.5 border-l border-gray-100 py-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          {excluindo ? '…' : 'Excluir'}
        </button>
      </div>
    </article>
  )
}
