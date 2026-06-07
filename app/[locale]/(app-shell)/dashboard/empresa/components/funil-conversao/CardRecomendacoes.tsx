'use client'

import type { RecomendacaoProfissional } from '../../types/dashboard.types'
import LinhaProfissionalRecomendacao from './LinhaProfissionalRecomendacao'
import RelatorioPastasCategoria from './RelatorioPastasCategoria'

interface Props {
  recomendacoes: RecomendacaoProfissional[]
  referenciaVistoEm?: string | null
  pastasVistas?: Set<string>
  profissionaisVistos?: Set<string>
  onPastaVista?: (categoria: string) => void
  onProfissionalVisto?: (profissionalId: string) => void
}

export default function CardRecomendacoes({
  recomendacoes,
  referenciaVistoEm,
  pastasVistas,
  profissionaisVistos,
  onPastaVista,
  onProfissionalVisto,
}: Props) {
  return (
    <RelatorioPastasCategoria
      prefixoId="rec"
      items={recomendacoes}
      referenciaVistoEm={referenciaVistoEm}
      pastasVistas={pastasVistas}
      profissionaisVistos={profissionaisVistos}
      onPastaVista={onPastaVista}
      onProfissionalVisto={onProfissionalVisto}
      vazioCategoria="Nenhuma recomendação nesta categoria"
      renderLinha={(prof, naoLidas, onVisto) => (
        <LinhaProfissionalRecomendacao
          key={prof.profissional_id}
          profissional={prof}
          naoLidas={naoLidas}
          onAberto={onVisto}
        />
      )}
    />
  )
}
