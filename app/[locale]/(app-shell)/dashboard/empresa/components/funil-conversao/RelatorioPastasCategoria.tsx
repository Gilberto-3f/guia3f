'use client'

import { useState, type ReactNode } from 'react'
import PastaRelatorioLista from './PastaRelatorioLista'
import {
  agruparPorCategoria,
  CATEGORIAS_CONFIG,
  CATEGORIAS_ORDEM,
  type CategoriaProfissionalFunil,
} from './categoriasProfissionalFunil'
import { contarNovosEventos, contarNovosPax } from './contarNovosFunil'

interface DetalheComData {
  created_at: string
}

interface ProfissionalComCategoria {
  profissional_id: string
  categoria: string
  total: number
  detalhes: DetalheComData[]
}

type ModoContagem = 'eventos' | 'pax'

interface Props<T extends ProfissionalComCategoria> {
  prefixoId: string
  items: T[]
  vazioCategoria: string
  referenciaVistoEm?: string | null
  modoContagem?: ModoContagem
  renderLinha: (item: T, naoLidas: number) => ReactNode
}

function contarNovosProfissional(item: ProfissionalComCategoria, vistoEm: string, modo: ModoContagem): number {
  if (modo === 'pax') {
    return contarNovosPax(item.detalhes as { created_at: string; pax_qtd: number }[], vistoEm)
  }
  return contarNovosEventos(item.detalhes, vistoEm)
}

export default function RelatorioPastasCategoria<T extends ProfissionalComCategoria>({
  prefixoId,
  items,
  vazioCategoria,
  referenciaVistoEm = null,
  modoContagem = 'eventos',
  renderLinha,
}: Props<T>) {
  const [pastaAberta, setPastaAberta] = useState<string | null>(null)
  const porCategoria = agruparPorCategoria(items)
  const vistoEm = referenciaVistoEm ?? ''

  const togglePasta = (id: string) => {
    setPastaAberta((atual) => (atual === id ? null : id))
  }

  return (
    <div>
      {CATEGORIAS_ORDEM.map((categoria: CategoriaProfissionalFunil) => {
        const lista = porCategoria[categoria] ?? []
        const totalCategoria = lista.reduce((sum, i) => sum + i.total, 0)
        const naoLidasPasta = vistoEm
          ? lista.reduce((s, item) => s + contarNovosProfissional(item, vistoEm, modoContagem), 0)
          : 0
        const { label, Icon } = CATEGORIAS_CONFIG[categoria]

        return (
          <PastaRelatorioLista
            key={categoria}
            id={`${prefixoId}-${categoria}`}
            titulo={`${label} (${totalCategoria})`}
            icon={Icon}
            naoLidas={naoLidasPasta}
            controlado
            aberto={pastaAberta === categoria}
            onToggle={() => togglePasta(categoria)}
          >
            {lista.length === 0 ? (
              <p className="py-2 text-sm text-gray-500">{vazioCategoria}</p>
            ) : (
              <div>
                {lista.map((item) => {
                  const naoLidas = vistoEm ? contarNovosProfissional(item, vistoEm, modoContagem) : 0
                  return renderLinha(item, naoLidas)
                })}
              </div>
            )}
          </PastaRelatorioLista>
        )
      })}
    </div>
  )
}
