'use client'

import { Award, MousePointerClick, Eye, PieChart, ThumbsUp } from 'lucide-react'
import { useDrenaCatalogo } from '../../hooks/useDrenaCatalogo'
import type { PeriodoDrena } from '@/lib/drenaAnalytics'
import { iconeCategoriaProduto } from '@/lib/comprasCdeCategoriaIcone'
import MiniCardRankingProduto from './MiniCardRankingProduto'
import PizzaCategorias from './PizzaCategorias'

const VERDE = '#00D443'
const AZUL = '#0097b2'

const PERIODOS: { id: PeriodoDrena; label: string }[] = [
  { id: '24h', label: '24h' },
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' },
]

type Props = {
  empresaId: string | null
}

/** Catálogo — desempenho dos produtos da empresa. */
export default function AbaCatalogo({ empresaId }: Props) {
  const cat = useDrenaCatalogo(empresaId)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {PERIODOS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => cat.setPeriodo(p.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                cat.periodo === p.id
                  ? 'bg-[#0097b2] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-gray-600">
          <span className="inline-flex items-center gap-1">
            <MousePointerClick className="h-3.5 w-3.5 text-[#0097b2]" aria-hidden />
            <strong>{cat.totalCliques}</strong> cliques
          </span>
          <span className="inline-flex items-center gap-1">
            <Eye className="h-3.5 w-3.5 text-gray-400" aria-hidden />
            <strong>{cat.totalImpressoes}</strong> impressões
          </span>
          <span className="inline-flex items-center gap-1">
            <ThumbsUp className="h-3.5 w-3.5 text-[#00D443]" aria-hidden />
            <strong>{cat.totalRecomendacoes}</strong> indicações
          </span>
        </div>
      </div>

      {cat.loading ? (
        <div className="space-y-3">
          <div className="h-32 animate-pulse rounded-xl bg-gray-100" />
          <div className="h-48 animate-pulse rounded-xl bg-gray-100" />
        </div>
      ) : cat.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {cat.error.message}
        </div>
      ) : (
        <>
          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <header className="flex items-center gap-2 border-b border-gray-100 bg-[#f5f5f5] px-4 py-3">
              <Award className="h-5 w-5 shrink-0" style={{ color: AZUL }} strokeWidth={2.25} aria-hidden />
              <h2 className="text-sm font-bold text-[#001f3f]">Ranking do Catálogo</h2>
            </header>
            <div className="space-y-5 p-4">
              <div>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                  <MousePointerClick className="h-3.5 w-3.5" aria-hidden />
                  Produtos mais procurados
                </h3>
                {cat.secoesPorCliques.length === 0 ? (
                  <p className="rounded-lg bg-gray-50 py-6 text-center text-sm text-gray-400">
                    Nenhum clique nos seus produtos neste período.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {cat.secoesPorCliques.map((sec) => {
                      const Icone = iconeCategoriaProduto(sec.categoriaNome)
                      return (
                        <div key={sec.categoriaId}>
                          <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-[#0097b2]">
                            <Icone className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                            {sec.categoriaNome}
                            <span className="font-normal text-gray-400">
                              · {sec.totalCliques} cliques
                            </span>
                          </p>
                          <ul className="space-y-2">
                            {sec.produtos.map((p, i) => (
                              <li key={p.id}>
                                <MiniCardRankingProduto posicao={i + 1} item={p} modo="cliques" />
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                  <PieChart className="h-3.5 w-3.5" aria-hidden />
                  Categoria mais buscada
                </h3>
                <PizzaCategorias
                  fatias={cat.pizzaCliques}
                  vazio="Sem cliques por categoria neste período."
                />
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <header className="flex items-center gap-2 border-b border-gray-100 bg-[#f5f5f5] px-4 py-3">
              <ThumbsUp
                className="h-5 w-5 shrink-0"
                style={{ color: VERDE }}
                strokeWidth={2.25}
                aria-hidden
              />
              <h2 className="text-sm font-bold text-[#001f3f]">Ranking de Recomendações</h2>
            </header>
            <div className="space-y-5 p-4">
              <div>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                  <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
                  Produtos mais recomendados
                </h3>
                {cat.secoesPorRecomendacoes.length === 0 ? (
                  <p className="rounded-lg bg-gray-50 py-6 text-center text-sm text-gray-400">
                    Nenhuma indicação de produto neste período.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {cat.secoesPorRecomendacoes.map((sec) => {
                      const Icone = iconeCategoriaProduto(sec.categoriaNome)
                      return (
                        <div key={sec.categoriaId}>
                          <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-[#00D443]">
                            <Icone className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                            {sec.categoriaNome}
                            <span className="font-normal text-gray-400">
                              · {sec.totalRecomendacoes} indicações
                            </span>
                          </p>
                          <ul className="space-y-2">
                            {sec.produtos.map((p, i) => (
                              <li key={p.id}>
                                <MiniCardRankingProduto
                                  posicao={i + 1}
                                  item={p}
                                  modo="recomendacoes"
                                />
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                  <PieChart className="h-3.5 w-3.5" aria-hidden />
                  Categorias mais recomendadas
                </h3>
                <PizzaCategorias
                  fatias={cat.pizzaRecomendacoes}
                  vazio="Sem recomendações por categoria neste período."
                />
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
