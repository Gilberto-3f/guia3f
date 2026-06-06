'use client'

import type { RecomendacaoProfissional } from '../../types/dashboard.types'
import LinhaProfissionalRecomendacao from './LinhaProfissionalRecomendacao'
import RelatorioPastasCategoria from './RelatorioPastasCategoria'

interface Props {
  recomendacoes: RecomendacaoProfissional[]
  referenciaVistoEm?: string | null
}

export default function CardRecomendacoes({ recomendacoes, referenciaVistoEm }: Props) {
  return (
    <RelatorioPastasCategoria
      prefixoId="rec"
      items={recomendacoes}
      referenciaVistoEm={referenciaVistoEm}
      vazioCategoria="Nenhuma recomendação nesta categoria"
      renderLinha={(prof, naoLidas) => (
        <LinhaProfissionalRecomendacao key={prof.profissional_id} profissional={prof} naoLidas={naoLidas} />
      )}
    />
  )
}
