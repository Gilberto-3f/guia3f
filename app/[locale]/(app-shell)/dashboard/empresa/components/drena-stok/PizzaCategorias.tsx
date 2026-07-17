'use client'

import type { FatiaCategoria } from '@/lib/drenaAnalytics'

type Props = {
  fatias: FatiaCategoria[]
  vazio?: string
}

/** Pizza SVG + legenda (Drena-Stok). */
export default function PizzaCategorias({
  fatias,
  vazio = 'Sem dados de categoria no período',
}: Props) {
  if (!fatias.length) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-gray-400">{vazio}</div>
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
      <ul className="w-full space-y-1.5 text-xs text-gray-700">
        {fatias.map((f, i) => (
          <li key={f.id} className="flex items-center gap-2">
            <span className="w-4 shrink-0 text-right text-[10px] text-gray-400">{i + 1}.</span>
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: f.cor }} />
            <span className="min-w-0 flex-1 truncate font-medium">{f.nome}</span>
            <span className="shrink-0 tabular-nums text-gray-500">
              {f.total} · {f.percentual.toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
