'use client'

import {
  CATEGORIAS_CONFIG,
  ordenarCategoriasRanking,
  type CategoriaProfissionalFunil,
} from '../funil-conversao/categoriasProfissionalFunil'
import type { RecomendacaoCategoriaAgregada } from '../../types/dashboard.types'

interface Props {
  items: RecomendacaoCategoriaAgregada[]
}

export default function RecomendacoesCategoriaResumo({ items }: Props) {
  const totais = Object.fromEntries(
    items.map((item) => [item.categoria as CategoriaProfissionalFunil, item.total]),
  ) as Partial<Record<CategoriaProfissionalFunil, number>>

  const ranking = ordenarCategoriasRanking(totais)

  return (
    <div className="divide-y divide-gray-100">
      {ranking.map(({ categoria, total }, indice) => {
        const posicao = indice + 1
        const { label, Icon } = CATEGORIAS_CONFIG[categoria]
        return (
          <div key={categoria} className="flex items-center gap-3 py-3">
            <span className="w-7 shrink-0 tabular-nums text-sm font-bold text-[#0097b2]">{posicao}º</span>
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
