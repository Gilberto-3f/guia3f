'use client'

import type { PaxProfissional } from '../../types/dashboard.types'
import LinhaProfissionalPax from './LinhaProfissionalPax'
import RelatorioPastasCategoria from './RelatorioPastasCategoria'

interface Props {
  paxPorProfissional: PaxProfissional[]
  referenciaVistoEm?: string | null
  pastasVistas?: Set<string>
  profissionaisVistos?: Set<string>
  onPastaVista?: (categoria: string) => void
  onProfissionalVisto?: (profissionalId: string) => void
}

export default function TopPaxProfissionais({
  paxPorProfissional,
  referenciaVistoEm,
  pastasVistas,
  profissionaisVistos,
  onPastaVista,
  onProfissionalVisto,
}: Props) {
  return (
    <RelatorioPastasCategoria
      prefixoId="pax"
      items={paxPorProfissional}
      referenciaVistoEm={referenciaVistoEm}
      pastasVistas={pastasVistas}
      profissionaisVistos={profissionaisVistos}
      onPastaVista={onPastaVista}
      onProfissionalVisto={onProfissionalVisto}
      modoContagem="pax"
      vazioCategoria="Nenhum PAX nesta categoria"
      renderLinha={(prof, naoLidas, onVisto) => (
        <LinhaProfissionalPax
          key={prof.profissional_id}
          profissional={prof}
          naoLidas={naoLidas}
          onAberto={onVisto}
        />
      )}
    />
  )
}
