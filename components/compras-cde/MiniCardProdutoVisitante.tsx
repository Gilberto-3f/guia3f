'use client'

import { useEffect, useRef } from 'react'
import { Info, Eye } from 'lucide-react'
import BotaoEstrelaFavorito from '@/components/favoritos/BotaoEstrelaFavorito'
import PrecoProdutoCde from '@/components/compras-cde/PrecoProdutoCde'
import { precoFinalUsd, type ProdutoCdeRow } from '@/lib/comprasCdeCatalogo'
import type { CotacaoMap } from '@/lib/comprasCdeHub'
import type { MoedaPadraoLoja } from '@/lib/comprasCdeMoedaPadrao'

const COR = '#0097b2'
const VERDE = '#00D443'

type Props = {
  item: ProdutoCdeRow
  /** @deprecated Prefira `cotacoes`. Mantido para compatibilidade. */
  taxaUsd?: number
  cotacoes?: CotacaoMap
  /** Moeda padrão da loja (destaque no preço). */
  moedaPadrao?: MoedaPadraoLoja | string | null
  /** Mantido por compatibilidade — nota fica só no card azul da empresa. */
  notaMediaEmpresa?: number | null
  visitanteId: string | null
  favoritoInicial: boolean
  onFavoritoChange: (salvo: boolean) => void
  onInfo: () => void
  onVerProduto: () => void
  /** Dispara 1x por montagem quando o card entra na viewport (≥40%). */
  onImpressao?: () => void
  /** Classes extras no article (hub grid vs carrossel). */
  className?: string
  /** Carrossel do drawer: altura fixa nas linhas opcionais. */
  tamanhoUniforme?: boolean
}

export default function MiniCardProdutoVisitante({
  item,
  taxaUsd = 0.2,
  cotacoes,
  moedaPadrao = 'USD',
  notaMediaEmpresa: _notaMediaEmpresa = null,
  visitanteId,
  favoritoInicial,
  onFavoritoChange,
  onInfo,
  onVerProduto,
  onImpressao,
  className = 'w-[78%] max-w-[280px] shrink-0 snap-start',
  tamanhoUniforme = false,
}: Props) {
  const pct = Number(item.percentual_desconto) || 0
  const finalUsd = precoFinalUsd(item.preco_usd, pct)
  const mapCotacoes: CotacaoMap = cotacoes ?? { USD: taxaUsd, EUR: 0.18, ARS: 180, PYG: 1500 }
  const capa = item.fotos[0] ?? item.foto_url
  const rootRef = useRef<HTMLElement | null>(null)
  const impressaoEnviada = useRef(false)

  useEffect(() => {
    impressaoEnviada.current = false
  }, [item.id])

  useEffect(() => {
    if (!onImpressao) return
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return

    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.4)
        if (!hit || impressaoEnviada.current) return
        impressaoEnviada.current = true
        onImpressao()
        obs.disconnect()
      },
      { threshold: [0.4] },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [onImpressao, item.id])

  return (
    <article
      ref={rootRef}
      className={`flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm ${tamanhoUniforme ? 'min-h-[20rem]' : ''} ${className}`}
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
        {pct > 0 ? (
          <span className="shrink-0 text-sm font-bold text-[#00D443]" aria-label={`Em oferta −${pct}%`}>
            %
          </span>
        ) : null}
        <BotaoEstrelaFavorito
          usuarioId={visitanteId}
          alvoId={item.id}
          tipo="produto"
          inicial={favoritoInicial}
          size={18}
          onChange={onFavoritoChange}
        />
      </div>

      <div className="relative mt-2 aspect-[4/3] w-full shrink-0 overflow-hidden bg-gray-100">
        {capa ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={capa} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : null}
      </div>

      <div className={`flex flex-col gap-1 p-3 ${tamanhoUniforme ? 'flex-1' : ''}`}>
        <PrecoProdutoCde
          precoUsd={finalUsd}
          precoUsdCheio={pct > 0 ? item.preco_usd : null}
          cotacoes={mapCotacoes}
          moedaPadrao={moedaPadrao}
          destacarUsd
        />

        <div className="leading-tight">
          {item.subcategoria_nome ? (
            <p className="text-xs text-gray-500">{item.subcategoria_nome}</p>
          ) : null}
          {item.marca_nome ? (
            <p className="text-xs font-medium text-gray-700">{item.marca_nome}</p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onVerProduto}
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white ${tamanhoUniforme ? 'mt-auto' : 'mt-1'}`}
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
