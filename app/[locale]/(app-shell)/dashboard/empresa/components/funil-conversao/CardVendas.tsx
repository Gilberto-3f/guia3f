'use client'

import type { VendaProfissional } from '../../types/dashboard.types'
import LinhaProfissionalVenda from './LinhaProfissionalVenda'
import RelatorioPastasCategoria from './RelatorioPastasCategoria'

interface Props {
  vendasPorProfissional: VendaProfissional[]
  vendasSemProfissional: number
}

export default function CardVendas({ vendasPorProfissional, vendasSemProfissional }: Props) {
  return (
    <div className="space-y-3">
      <RelatorioPastasCategoria
        prefixoId="venda"
        items={vendasPorProfissional}
        vazioCategoria="Nenhuma venda nesta categoria"
        renderLinha={(prof) => <LinhaProfissionalVenda key={prof.profissional_id} profissional={prof} />}
      />
      {vendasSemProfissional > 0 ? (
        <p className="text-center text-sm text-gray-500">
          {vendasSemProfissional === 1
            ? '1 venda sem profissional vinculado'
            : `${vendasSemProfissional} vendas sem profissional vinculado`}
        </p>
      ) : null}
    </div>
  )
}
