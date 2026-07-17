'use client'

import { Eye, MousePointerClick, ThumbsUp } from 'lucide-react'
import type { ProdutoRankingItem } from '@/lib/drenaAnalytics'

type Props = {
  posicao: number
  item: ProdutoRankingItem
  modo: 'cliques' | 'recomendacoes'
}

/** Mini-card numerado do ranking Catálogo / Recomendações. */
export default function MiniCardRankingProduto({ posicao, item, modo }: Props) {
  const metrica =
    modo === 'cliques' ? (
      <>
        <span className="inline-flex items-center gap-1 font-bold text-[#0097b2]">
          <MousePointerClick className="h-3.5 w-3.5" aria-hidden />
          {item.cliques} {item.cliques === 1 ? 'clique' : 'cliques'}
        </span>
        <span className="inline-flex items-center gap-1 text-gray-500">
          <Eye className="h-3.5 w-3.5" aria-hidden />
          {item.impressoes} {item.impressoes === 1 ? 'impressão' : 'impressões'}
        </span>
      </>
    ) : (
      <span className="inline-flex items-center gap-1 font-bold text-[#00D443]">
        <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
        {item.recomendacoes} {item.recomendacoes === 1 ? 'indicação' : 'indicações'}
      </span>
    )

  return (
    <article className="flex gap-3 overflow-hidden rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0097b2] text-sm font-extrabold text-white"
        aria-label={`Posição ${posicao}`}
      >
        {posicao}
      </div>
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100">
        {item.fotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.fotoUrl} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#001f3f]">{item.nome}</p>
        {(item.subcategoriaNome || item.marcaNome) && (
          <p className="mt-0.5 truncate text-xs text-gray-500">
            {[item.subcategoriaNome, item.marcaNome].filter(Boolean).join(' · ')}
          </p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">{metrica}</div>
      </div>
    </article>
  )
}
