'use client'

import { useState, type ReactNode } from 'react'
import PastaEstatistica from '../estatisticas-mercado/PastaEstatistica'
import {
  agruparPorCategoria,
  CATEGORIAS_CONFIG,
  CATEGORIAS_ORDEM,
  type CategoriaProfissionalFunil,
} from './categoriasProfissionalFunil'

interface ProfissionalComCategoria {
  profissional_id: string
  categoria: string
  total: number
}

interface Props<T extends ProfissionalComCategoria> {
  prefixoId: string
  items: T[]
  vazioCategoria: string
  renderLinha: (item: T) => ReactNode
}

export default function RelatorioPastasCategoria<T extends ProfissionalComCategoria>({
  prefixoId,
  items,
  vazioCategoria,
  renderLinha,
}: Props<T>) {
  const [pastaAberta, setPastaAberta] = useState<string | null>(null)
  const porCategoria = agruparPorCategoria(items)

  const togglePasta = (id: string) => {
    setPastaAberta((atual) => (atual === id ? null : id))
  }

  return (
    <div className="space-y-2">
      {CATEGORIAS_ORDEM.map((categoria: CategoriaProfissionalFunil) => {
        const lista = porCategoria[categoria] ?? []
        const totalCategoria = lista.reduce((sum, i) => sum + i.total, 0)
        const { label, Icon } = CATEGORIAS_CONFIG[categoria]

        return (
          <PastaEstatistica
            key={categoria}
            id={`${prefixoId}-${categoria}`}
            titulo={`${label} (${totalCategoria})`}
            icon={Icon}
            controlado
            aberto={pastaAberta === categoria}
            onToggle={() => togglePasta(categoria)}
          >
            {lista.length === 0 ? (
              <p className="py-2 text-center text-sm text-gray-500">{vazioCategoria}</p>
            ) : (
              <div className="rounded-lg border border-gray-100 bg-white">
                {lista.map((item) => renderLinha(item))}
              </div>
            )}
          </PastaEstatistica>
        )
      })}
    </div>
  )
}
