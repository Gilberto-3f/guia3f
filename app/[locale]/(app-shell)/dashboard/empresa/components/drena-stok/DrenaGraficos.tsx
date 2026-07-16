'use client'

import type { FatiaCategoria, PeriodoDrena, TermoRanking } from '@/lib/drenaAnalytics'

type Props = {
  periodo: PeriodoDrena
  onPeriodo: (p: PeriodoDrena) => void
  ranking: TermoRanking[]
  pizza: FatiaCategoria[]
}

function PizzaSvg({ fatias }: { fatias: FatiaCategoria[] }) {
  if (!fatias.length) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-gray-400">
        Sem dados de categoria no período
      </div>
    )
  }

  const r = 60
  const cx = 70
  const cy = 70
  let ang = -Math.PI / 2
  const total = fatias.reduce((a, f) => a + f.total, 0) || 1

  const paths = fatias.map((f) => {
    const sweep = (f.total / total) * Math.PI * 2
    const x1 = cx + r * Math.cos(ang)
    const y1 = cy + r * Math.sin(ang)
    ang += sweep
    const x2 = cx + r * Math.cos(ang)
    const y2 = cy + r * Math.sin(ang)
    const large = sweep > Math.PI ? 1 : 0
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`
    return { d, cor: f.cor, id: f.id }
  })

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
      <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden>
        {paths.map((p) => (
          <path key={p.id} d={p.d} fill={p.cor} stroke="#fff" strokeWidth="1" />
        ))}
      </svg>
      <ul className="w-full space-y-1 text-xs text-gray-700">
        {fatias.slice(0, 8).map((f) => (
          <li key={f.id} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: f.cor }} />
            <span className="min-w-0 flex-1 truncate">{f.nome}</span>
            <span className="shrink-0 text-gray-500">{f.percentual.toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function DrenaGraficos({ periodo, onPeriodo, ranking, pizza }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: '24h', label: '24h' },
            { id: '7d', label: '7 dias' },
            { id: '30d', label: '30 dias' },
          ] as const
        ).map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPeriodo(p.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              periodo === p.id ? 'bg-[#0097b2] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-4">
          <h3 className="mb-3 font-bold text-[#001f3f]">🏆 Ranking de intenções (top 50)</h3>
          {ranking.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhuma intenção registrada neste período.</p>
          ) : (
            <ol className="max-h-80 space-y-1.5 overflow-y-auto text-sm">
              {ranking.map((r, i) => (
                <li key={r.termo_normalizado} className="flex items-center gap-2 text-gray-700">
                  <span className="w-6 shrink-0 text-right text-xs text-gray-400">{i + 1}.</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{r.termo}</span>
                  <span className="shrink-0 tabular-nums text-gray-500">{r.total}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="rounded-lg border bg-white p-4">
          <h3 className="mb-3 font-bold text-[#001f3f]">🍕 Categorias</h3>
          <PizzaSvg fatias={pizza} />
        </div>
      </div>
    </div>
  )
}
