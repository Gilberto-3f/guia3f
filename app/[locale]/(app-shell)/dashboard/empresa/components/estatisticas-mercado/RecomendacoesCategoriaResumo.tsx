'use client'

import PastaRelatorioLista from '../funil-conversao/PastaRelatorioLista'
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
    <div>
      {ranking.map(({ categoria, total }, indice) => {
        const posicao = indice + 1
        const { label, Icon } = CATEGORIAS_CONFIG[categoria]

        return (
          <PastaRelatorioLista
            key={categoria}
            id={`eco-${categoria}`}
            posicao={posicao}
            rotulo={label}
            total={total}
            rotuloBloco="recomendações"
            icon={Icon}
            expandivel={false}
          />
        )
      })}
    </div>
  )
}
