'use client'

import { BarChart3, Hash, Layers, PieChart, Search, Tags } from 'lucide-react'

const AZUL = '#0097b2'
const VERDE = '#00D443'

/** Compras CDE — analíticos do mercado geral (dados na fase 4). */
export default function AbaComprasCde() {
  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <header className="flex items-center gap-2 border-b border-gray-100 bg-[#f5f5f5] px-4 py-3">
          <Hash className="h-5 w-5 shrink-0" style={{ color: AZUL }} strokeWidth={2.25} aria-hidden />
          <h2 className="text-sm font-bold text-[#001f3f]">Ranking 100+</h2>
        </header>
        <div className="space-y-3 p-4">
          <p className="text-xs text-gray-500">
            Top 100 palavras-chave em 5 grupos de 20 · separados por Turistas e Profissionais.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-5 text-center">
              <Search className="mx-auto h-7 w-7 text-gray-300" strokeWidth={1.75} aria-hidden />
              <p className="mt-2 text-sm font-medium text-gray-600">Turistas</p>
            </div>
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-5 text-center">
              <Search className="mx-auto h-7 w-7 text-gray-300" strokeWidth={1.75} aria-hidden />
              <p className="mt-2 text-sm font-medium text-gray-600">Profissionais</p>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <header className="flex items-center gap-2 border-b border-gray-100 bg-[#f5f5f5] px-4 py-3">
          <Tags className="h-5 w-5 shrink-0" style={{ color: VERDE }} strokeWidth={2.25} aria-hidden />
          <h2 className="text-sm font-bold text-[#001f3f]">Ranking de Recomendações</h2>
        </header>
        <ul className="divide-y divide-gray-100 p-4 text-sm text-gray-600">
          <li className="flex items-center gap-2 py-2.5">
            <Layers className="h-4 w-4 text-gray-400" aria-hidden />
            Por categoria
          </li>
          <li className="flex items-center gap-2 py-2.5">
            <Layers className="h-4 w-4 text-gray-400" aria-hidden />
            Por subcategoria
          </li>
          <li className="flex items-center gap-2 py-2.5">
            <Tags className="h-4 w-4 text-gray-400" aria-hidden />
            Por marca
          </li>
        </ul>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <header className="flex items-center gap-2 border-b border-gray-100 bg-[#f5f5f5] px-4 py-3">
          <BarChart3 className="h-5 w-5 shrink-0" style={{ color: AZUL }} strokeWidth={2.25} aria-hidden />
          <h2 className="text-sm font-bold text-[#001f3f]">Ranking de Categorias</h2>
        </header>
        <div className="space-y-2 p-4 text-xs text-gray-500">
          <p>Filtro popup (categoria / subcategoria) · Motor de busca (cat/sub do produto localizado).</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <header className="flex items-center gap-2 border-b border-gray-100 bg-[#f5f5f5] px-4 py-3">
          <PieChart className="h-5 w-5 shrink-0" style={{ color: VERDE }} strokeWidth={2.25} aria-hidden />
          <h2 className="text-sm font-bold text-[#001f3f]">Gráficos</h2>
        </header>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-6 text-center text-sm text-gray-500">
            Pizza — % de buscas por categoria
          </div>
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-6 text-center text-sm text-gray-500">
            Lista — desempenho geral por categoria
          </div>
        </div>
      </section>
    </div>
  )
}
