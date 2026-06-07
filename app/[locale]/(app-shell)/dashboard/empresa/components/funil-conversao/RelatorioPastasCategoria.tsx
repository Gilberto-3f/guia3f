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
  pastasVistas?: Set<string>
  profissionaisVistos?: Set<string>
  onPastaVista?: (categoria: string) => void
  onProfissionalVisto?: (profissionalId: string) => void
  modoContagem?: ModoContagem
  renderLinha: (item: T, naoLidas: number, onProfissionalVisto?: () => void) => ReactNode
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
  pastasVistas,
  profissionaisVistos,
  onPastaVista,
  onProfissionalVisto,
  modoContagem = 'eventos',
  renderLinha,
}: Props<T>) {
  const [pastaAberta, setPastaAberta] = useState<string | null>(null)
  const porCategoria = agruparPorCategoria(items)
  const vistoEm = referenciaVistoEm ?? ''

  const togglePasta = (categoria: string) => {
    setPastaAberta((atual) => {
      if (atual === categoria) return null
      onPastaVista?.(categoria)
      return categoria
    })
  }

  return (
    <div>
      {CATEGORIAS_ORDEM.map((categoria: CategoriaProfissionalFunil) => {
        const lista = porCategoria[categoria] ?? []
        const totalCategoria = lista.reduce((sum, i) => sum + i.total, 0)
        const naoLidasPasta =
          vistoEm && !pastasVistas?.has(categoria)
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
                  const naoLidas =
                    vistoEm && !profissionaisVistos?.has(item.profissional_id)
                      ? contarNovosProfissional(item, vistoEm, modoContagem)
                      : 0
                  return renderLinha(item, naoLidas, () => onProfissionalVisto?.(item.profissional_id))
                })}
              </div>
            )}
          </PastaRelatorioLista>
        )
      })}
    </div>
  )
}
