'use client'

import type { PaxProfissional } from '../../types/dashboard.types'
import LinhaProfissionalPax from './LinhaProfissionalPax'
import RelatorioPastasCategoria from './RelatorioPastasCategoria'

interface Props {
  paxPorProfissional: PaxProfissional[]
}

export default function TopPaxProfissionais({ paxPorProfissional }: Props) {
  return (
    <RelatorioPastasCategoria
      prefixoId="pax"
      items={paxPorProfissional}
      vazioCategoria="Nenhum PAX nesta categoria"
      renderLinha={(prof) => <LinhaProfissionalPax key={prof.profissional_id} profissional={prof} />}
    />
  )
}
