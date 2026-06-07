'use client'

import {
  CATEGORIAS_CONFIG,
  CATEGORIAS_ORDEM,
  type CategoriaProfissionalFunil,
} from '../funil-conversao/categoriasProfissionalFunil'
import type { RecomendacaoCategoriaAgregada } from '../../types/dashboard.types'

interface Props {
  items: RecomendacaoCategoriaAgregada[]
}

export default function RecomendacoesCategoriaResumo({ items }: Props) {
  const porCategoria = Object.fromEntries(CATEGORIAS_ORDEM.map((cat) => [cat, 0])) as Record<
    CategoriaProfissionalFunil,
    number
  >

  for (const item of items) {
    const key = item.categoria as CategoriaProfissionalFunil
    if (key in porCategoria) {
      porCategoria[key] += item.total
    }
  }

  const totalGeral = Object.values(porCategoria).reduce((s, n) => s + n, 0)

  if (totalGeral === 0) {
    return <p className="py-2 text-sm text-gray-500">Nenhuma recomendação no período selecionado.</p>
  }

  return (
    <div className="divide-y divide-gray-100">
      {CATEGORIAS_ORDEM.map((cat) => {
        const total = porCategoria[cat]
        if (total <= 0) return null
        const { label, Icon } = CATEGORIAS_CONFIG[cat]
        return (
          <div key={cat} className="flex items-center gap-3 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#0097b2] text-white">
              <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
            </span>
            <span className="min-w-0 flex-1 text-[15px] text-gray-900">{label}</span>
            <span className="shrink-0 text-base font-bold tabular-nums text-[#001f3f]">
              {total.toLocaleString('pt-BR')}
            </span>
          </div>
        )
      })}
    </div>
  )
}
