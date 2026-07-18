'use client'

import { useState } from 'react'
import {
  Award,
  Eye,
  MessageSquareQuote,
  MousePointerClick,
  Package,
  PieChart,
  ThumbsUp,
} from 'lucide-react'
import ChevronPasta from '@/app/[locale]/(app-shell)/empresa/components/menu-empresa/hospedagem/ChevronPasta'
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
  const [feedbackAberto, setFeedbackAberto] = useState(true)
  const [rankingAberto, setRankingAberto] = useState(true)
  const [recsAberto, setRecsAberto] = useState(true)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-center gap-2">
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
          <ChevronPasta
            titulo="Feedback"
            aberto={feedbackAberto}
            onToggle={() => setFeedbackAberto((v) => !v)}
            icone={MessageSquareQuote}
            corTitulo={AZUL}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-[#f5f5f5] px-3 py-3 text-center">
                <Package className="mx-auto h-4 w-4 text-[#0097b2]" aria-hidden />
                <p className="mt-1 text-[10px] font-bold uppercase text-gray-500">Catálogo</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-[#001f3f]">
                  {cat.produtos.length}
                </p>
                <p className="text-[10px] text-gray-400">produtos</p>
              </div>
              <div className="rounded-lg bg-[#f5f5f5] px-3 py-3 text-center">
                <MousePointerClick className="mx-auto h-4 w-4 text-[#0097b2]" aria-hidden />
                <p className="mt-1 text-[10px] font-bold uppercase text-gray-500">Cliques</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-[#001f3f]">
                  {cat.totalCliques}
                </p>
              </div>
              <div className="rounded-lg bg-[#f5f5f5] px-3 py-3 text-center">
                <Eye className="mx-auto h-4 w-4 text-gray-400" aria-hidden />
                <p className="mt-1 text-[10px] font-bold uppercase text-gray-500">Impressões</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-[#001f3f]">
                  {cat.totalImpressoes}
                </p>
              </div>
              <div className="rounded-lg bg-[#f5f5f5] px-3 py-3 text-center">
                <ThumbsUp className="mx-auto h-4 w-4 text-[#00D443]" aria-hidden />
                <p className="mt-1 text-[10px] font-bold uppercase text-gray-500">Indicações</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-[#001f3f]">
                  {cat.totalRecomendacoes}
                </p>
              </div>
            </div>
          </ChevronPasta>

          <ChevronPasta
            titulo="Ranking do Catálogo"
            aberto={rankingAberto}
            onToggle={() => setRankingAberto((v) => !v)}
            icone={Award}
            corTitulo={AZUL}
          >
            <div className="space-y-5">
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
          </ChevronPasta>

          <ChevronPasta
            titulo="Ranking de Recomendações"
            aberto={recsAberto}
            onToggle={() => setRecsAberto((v) => !v)}
            icone={ThumbsUp}
            corTitulo={VERDE}
          >
            <div className="space-y-5">
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
          </ChevronPasta>
        </>
      )}
    </div>
  )
}
