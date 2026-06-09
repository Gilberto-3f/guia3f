'use client'

interface Item {
  label: string
  valor: number
  cor?: string
}

interface Props {
  dados: Item[]
}

export default function RankingBuscasGuia({ dados }: Props) {
  if (dados.length === 0) return null

  return (
    <ol className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
      {dados.map((item, i) => (
        <li key={`${item.label}-${i}`} className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: item.cor ?? '#0097b2' }}
            >
              {i + 1}
            </span>
            <span className="truncate text-sm font-medium text-gray-800">{item.label}</span>
          </div>
          <span className="shrink-0 text-sm tabular-nums text-gray-500">
            {item.valor.toLocaleString('pt-BR')} buscas
          </span>
        </li>
      ))}
    </ol>
  )
}
