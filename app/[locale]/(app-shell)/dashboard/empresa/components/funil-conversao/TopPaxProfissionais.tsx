'use client'

import type { PaxProfissional } from '../../types/dashboard.types'
import LinhaProfissionalPax from './LinhaProfissionalPax'
import RelatorioPastasCategoria from './RelatorioPastasCategoria'

interface Props {
  paxPorProfissional: PaxProfissional[]
  referenciaVistoEm?: string | null
}

export default function TopPaxProfissionais({ paxPorProfissional, referenciaVistoEm }: Props) {
  return (
    <RelatorioPastasCategoria
      prefixoId="pax"
      items={paxPorProfissional}
      referenciaVistoEm={referenciaVistoEm}
      modoContagem="pax"
      vazioCategoria="Nenhum PAX nesta categoria"
      renderLinha={(prof, naoLidas) => (
        <LinhaProfissionalPax key={prof.profissional_id} profissional={prof} naoLidas={naoLidas} />
      )}
    />
  )
}
