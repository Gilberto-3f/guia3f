'use client'

import type { VendaProfissional } from '../../types/dashboard.types'
import LinhaProfissionalVenda from './LinhaProfissionalVenda'
import RelatorioPastasCategoria from './RelatorioPastasCategoria'

interface Props {
  vendasPorProfissional: VendaProfissional[]
  vendasSemProfissional: number
  referenciaVistoEm?: string | null
  pastasVistas?: Set<string>
  profissionaisVistos?: Set<string>
  onPastaVista?: (categoria: string) => void
  onProfissionalVisto?: (profissionalId: string) => void
}

export default function CardVendas({
  vendasPorProfissional,
  vendasSemProfissional,
  referenciaVistoEm,
  pastasVistas,
  profissionaisVistos,
  onPastaVista,
  onProfissionalVisto,
}: Props) {
  return (
    <div className="space-y-3">
      <RelatorioPastasCategoria
        prefixoId="venda"
        items={vendasPorProfissional}
        referenciaVistoEm={referenciaVistoEm}
        pastasVistas={pastasVistas}
        profissionaisVistos={profissionaisVistos}
        onPastaVista={onPastaVista}
        onProfissionalVisto={onProfissionalVisto}
        rotuloBloco="vendas"
        vazioCategoria="Nenhuma venda nesta categoria"
        renderLinha={(prof, naoLidas, onVisto, posicao) => (
          <LinhaProfissionalVenda
            key={prof.profissional_id}
            profissional={prof}
            naoLidas={naoLidas}
            onAberto={onVisto}
            posicao={posicao}
          />
        )}
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
