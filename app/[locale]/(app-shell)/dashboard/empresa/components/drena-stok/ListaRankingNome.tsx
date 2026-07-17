'use client'

import type { ItemNomeTotal } from '../../hooks/useDrenaComprasCde'

type Props = {
  itens: ItemNomeTotal[]
  rotuloTotal?: string
  vazio?: string
  corPosicao?: string
}

/** Lista numerada id · nome · total. */
export default function ListaRankingNome({
  itens,
  rotuloTotal = '×',
  vazio = 'Sem dados neste período.',
  corPosicao = '#0097b2',
}: Props) {
  if (!itens.length) {
    return <p className="py-4 text-center text-sm text-gray-400">{vazio}</p>
  }
  return (
    <ol className="max-h-64 space-y-1 overflow-y-auto text-sm">
      {itens.map((item, i) => (
        <li
          key={item.id}
          className="flex items-center gap-2 rounded-lg bg-gray-50 px-2 py-1.5 text-gray-700"
        >
          <span className="w-6 shrink-0 text-right text-xs font-bold" style={{ color: corPosicao }}>
            {i + 1}.
          </span>
          <span className="min-w-0 flex-1 truncate font-medium">{item.nome}</span>
          <span className="shrink-0 tabular-nums text-xs text-gray-500">
            {item.total}
            {rotuloTotal !== '×' ? ` ${rotuloTotal}` : ''}
          </span>
        </li>
      ))}
    </ol>
  )
}
