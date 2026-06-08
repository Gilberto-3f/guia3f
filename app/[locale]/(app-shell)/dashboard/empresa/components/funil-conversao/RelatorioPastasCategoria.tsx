'use client'

import { useState, type ReactNode } from 'react'
import PastaRelatorioLista from './PastaRelatorioLista'
import {
  agruparPorCategoria,
  CATEGORIAS_CONFIG,
  CATEGORIAS_ORDEM,
  categoriaFunilTextoCompacto,
  labelCategoriaFunilExibicao,
  ordenarCategoriasRanking,
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
  renderLinha: (item: T, naoLidas: number, onProfissionalVisto?: () => void, posicao?: number) => ReactNode
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

  const totaisPorCategoria = Object.fromEntries(
    CATEGORIAS_ORDEM.map((cat) => [cat, (porCategoria[cat] ?? []).reduce((sum, i) => sum + i.total, 0)]),
  ) as Record<CategoriaProfissionalFunil, number>

  const categoriasRanking = ordenarCategoriasRanking(totaisPorCategoria)

  const togglePasta = (categoria: string) => {
    setPastaAberta((atual) => {
      if (atual === categoria) return null
      onPastaVista?.(categoria)
      return categoria
    })
  }

  return (
    <div>
      {categoriasRanking.map(({ categoria, total: totalCategoria }, indiceRanking) => {
        const lista = porCategoria[categoria] ?? []
        const posicao = indiceRanking + 1
        const naoLidasPasta =
          vistoEm && !pastasVistas?.has(categoria)
            ? lista.reduce((s, item) => s + contarNovosProfissional(item, vistoEm, modoContagem), 0)
            : 0
        const { Icon } = CATEGORIAS_CONFIG[categoria]
        const label = labelCategoriaFunilExibicao(categoria, totalCategoria)

        return (
          <PastaRelatorioLista
            key={categoria}
            id={`${prefixoId}-${categoria}`}
            posicao={posicao}
            titulo={`${label} (${totalCategoria.toLocaleString('pt-BR')})`}
            icon={Icon}
            naoLidas={naoLidasPasta}
            textoCompacto={categoriaFunilTextoCompacto(totalCategoria)}
            controlado
            aberto={pastaAberta === categoria}
            onToggle={() => togglePasta(categoria)}
          >
            {lista.length === 0 ? (
              <p className="py-2 text-sm text-gray-500">{vazioCategoria}</p>
            ) : (
              <div>
                {lista.map((item, indiceProf) => {
                  const naoLidas =
                    vistoEm && !profissionaisVistos?.has(item.profissional_id)
                      ? contarNovosProfissional(item, vistoEm, modoContagem)
                      : 0
                  return renderLinha(
                    item,
                    naoLidas,
                    () => onProfissionalVisto?.(item.profissional_id),
                    indiceProf + 1,
                  )
                })}
              </div>
            )}
          </PastaRelatorioLista>
        )
      })}
    </div>
  )
}
