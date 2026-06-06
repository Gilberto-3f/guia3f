'use client'

import type { RecomendacaoProfissional } from '../../types/dashboard.types'
import LinhaProfissionalRecomendacao from './LinhaProfissionalRecomendacao'
import RelatorioPastasCategoria from './RelatorioPastasCategoria'

interface Props {
  recomendacoes: RecomendacaoProfissional[]
}

export default function CardRecomendacoes({ recomendacoes }: Props) {
  return (
    <RelatorioPastasCategoria
      prefixoId="rec"
      items={recomendacoes}
      vazioCategoria="Nenhuma recomendação nesta categoria"
      renderLinha={(prof) => <LinhaProfissionalRecomendacao key={prof.profissional_id} profissional={prof} />}
    />
  )
}
