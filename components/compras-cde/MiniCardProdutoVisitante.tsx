'use client'

import { Info, Eye, Star } from 'lucide-react'
import BotaoEstrelaFavorito from '@/components/favoritos/BotaoEstrelaFavorito'
import {
  formatarBrl,
  formatarUsd,
  precoFinalUsd,
  usdParaBrl,
  type ProdutoCdeRow,
} from '@/lib/comprasCdeCatalogo'

const COR = '#0097b2'
const VERDE = '#00D443'

type Props = {
  item: ProdutoCdeRow
  taxaUsd: number
  notaMediaEmpresa: number | null
  visitanteId: string | null
  favoritoInicial: boolean
  onFavoritoChange: (salvo: boolean) => void
  onInfo: () => void
  onVerProduto: () => void
  /** Classes extras no article (hub grid vs carrossel). */
  className?: string
}

export default function MiniCardProdutoVisitante({
  item,
  taxaUsd,
  notaMediaEmpresa,
  visitanteId,
  favoritoInicial,
  onFavoritoChange,
  onInfo,
  onVerProduto,
  className = 'w-[78%] max-w-[280px] shrink-0 snap-start',
}: Props) {
  const pct = Number(item.percentual_desconto) || 0
  const finalUsd = precoFinalUsd(item.preco_usd, pct)
  const brl = usdParaBrl(finalUsd, taxaUsd)
  const capa = item.fotos[0] ?? item.foto_url

  return (
    <article
      className={`overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm ${className}`}
    >
      <div className="flex items-center gap-1.5 px-3 pt-3">
        <button
          type="button"
          onClick={onInfo}
          className="shrink-0 rounded-md p-0.5 text-[#0097b2] hover:bg-[#0097b2]/10"
          aria-label="Atenção sobre ofertas"
        >
          <Info className="h-4 w-4" aria-hidden />
        </button>
        <p className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-[#001f3f]">{item.nome}</p>
        <BotaoEstrelaFavorito
          usuarioId={visitanteId}
          alvoId={item.id}
          tipo="produto"
          inicial={favoritoInicial}
          size={18}
          onChange={onFavoritoChange}
        />
      </div>

      <div className="mt-2 aspect-[4/3] bg-gray-100">
        {capa ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={capa} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>

      <div className="space-y-2 p-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-sm font-bold" style={{ color: VERDE }}>
            {formatarUsd(finalUsd)}
          </p>
          {pct > 0 ? (
            <span className="rounded bg-[#00D443]/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#00D443]">
              Em oferta
            </span>
          ) : null}
          {notaMediaEmpresa != null && notaMediaEmpresa > 0 ? (
            <p className="inline-flex items-center gap-0.5 text-xs font-bold text-amber-500">
              <Star className="h-3 w-3 fill-current" aria-hidden />
              {notaMediaEmpresa.toFixed(1)}
            </p>
          ) : null}
        </div>

        {brl > 0 ? (
          <p className="text-sm font-medium text-black">
            <span aria-hidden>🇧🇷 </span>
            {formatarBrl(brl)}
          </p>
        ) : null}

        {item.subcategoria_nome ? (
          <p className="text-xs text-gray-500">{item.subcategoria_nome}</p>
        ) : null}

        <button
          type="button"
          onClick={onVerProduto}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white"
          style={{ backgroundColor: VERDE }}
        >
          <Eye className="h-4 w-4" aria-hidden />
          VER PRODUTO
        </button>
      </div>
    </article>
  )
}

export { COR as COR_DRAWER_PRODUTOS }
