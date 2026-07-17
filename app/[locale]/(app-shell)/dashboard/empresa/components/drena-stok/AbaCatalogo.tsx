'use client'

import { Award, LayoutGrid, PieChart, ThumbsUp } from 'lucide-react'

const VERDE = '#00D443'
const AZUL = '#0097b2'

/** Catálogo — desempenho dos produtos da empresa (dados na fase 3). */
export default function AbaCatalogo() {
  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <header className="flex items-center gap-2 border-b border-gray-100 bg-[#f5f5f5] px-4 py-3">
          <Award className="h-5 w-5 shrink-0" style={{ color: AZUL }} strokeWidth={2.25} aria-hidden />
          <h2 className="text-sm font-bold text-[#001f3f]">Ranking do Catálogo</h2>
        </header>
        <div className="space-y-4 p-4">
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-6 text-center">
            <LayoutGrid className="mx-auto h-8 w-8 text-gray-300" strokeWidth={1.75} aria-hidden />
            <p className="mt-2 text-sm font-medium text-gray-600">Produtos mais procurados</p>
            <p className="mt-1 text-xs text-gray-400">
              Mini-cards numerados por cliques (impressões à parte) — em breve.
            </p>
          </div>
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-6 text-center">
            <PieChart className="mx-auto h-8 w-8 text-gray-300" strokeWidth={1.75} aria-hidden />
            <p className="mt-2 text-sm font-medium text-gray-600">Categoria mais buscada</p>
            <p className="mt-1 text-xs text-gray-400">Lista + pizza (só categorias com produtos seus).</p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <header className="flex items-center gap-2 border-b border-gray-100 bg-[#f5f5f5] px-4 py-3">
          <ThumbsUp className="h-5 w-5 shrink-0" style={{ color: VERDE }} strokeWidth={2.25} aria-hidden />
          <h2 className="text-sm font-bold text-[#001f3f]">Ranking de Recomendações</h2>
        </header>
        <div className="space-y-4 p-4">
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-6 text-center">
            <p className="text-sm font-medium text-gray-600">Produtos mais recomendados</p>
            <p className="mt-1 text-xs text-gray-400">Indicações de profissionais (recomendacoes_produto).</p>
          </div>
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-6 text-center">
            <PieChart className="mx-auto h-8 w-8 text-gray-300" strokeWidth={1.75} aria-hidden />
            <p className="mt-2 text-sm font-medium text-gray-600">Categorias mais recomendadas</p>
            <p className="mt-1 text-xs text-gray-400">Lista + pizza agregada por categoria.</p>
          </div>
        </div>
      </section>
    </div>
  )
}
