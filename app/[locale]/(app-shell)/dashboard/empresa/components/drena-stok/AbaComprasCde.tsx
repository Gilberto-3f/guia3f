'use client'

import { useState } from 'react'
import {
  BarChart3,
  Hash,
  Layers,
  PieChart,
  Search,
  Tags,
} from 'lucide-react'
import type { PeriodoDrena } from '@/lib/drenaAnalytics'
import { useDrenaComprasCde } from '../../hooks/useDrenaComprasCde'
import Ranking100Grupos from './Ranking100Grupos'
import ListaRankingNome from './ListaRankingNome'
import PizzaCategorias from './PizzaCategorias'

const AZUL = '#0097b2'
const VERDE = '#00D443'

const PERIODOS: { id: PeriodoDrena; label: string }[] = [
  { id: '24h', label: '24h' },
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' },
]

/** Compras CDE — analíticos do mercado geral. */
export default function AbaComprasCde() {
  const d = useDrenaComprasCde()
  const [gruposTur, setGruposTur] = useState(1)
  const [gruposProf, setGruposProf] = useState(1)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {PERIODOS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              d.setPeriodo(p.id)
              setGruposTur(1)
              setGruposProf(1)
            }}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              d.periodo === p.id
                ? 'bg-[#0097b2] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {d.loading ? (
        <div className="space-y-3">
          <div className="h-40 animate-pulse rounded-xl bg-gray-100" />
          <div className="h-40 animate-pulse rounded-xl bg-gray-100" />
        </div>
      ) : d.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {d.error.message}
        </div>
      ) : (
        <>
          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <header className="flex items-center gap-2 border-b border-gray-100 bg-[#f5f5f5] px-4 py-3">
              <Hash className="h-5 w-5 shrink-0" style={{ color: AZUL }} strokeWidth={2.25} aria-hidden />
              <h2 className="text-sm font-bold text-[#001f3f]">Ranking 100+</h2>
            </header>
            <div className="space-y-3 p-4">
              <p className="text-xs text-gray-500">
                Top 100 palavras-chave do motor de busca · 5 grupos de 20 · Turistas e Profissionais.
              </p>
              <div className="grid gap-3 lg:grid-cols-2">
                <Ranking100Grupos
                  titulo="Turistas"
                  grupos={d.gruposTuristas}
                  gruposLiberados={gruposTur}
                  onLiberarProximo={() => setGruposTur((n) => Math.min(5, n + 1))}
                />
                <Ranking100Grupos
                  titulo="Profissionais"
                  grupos={d.gruposProfissionais}
                  gruposLiberados={gruposProf}
                  onLiberarProximo={() => setGruposProf((n) => Math.min(5, n + 1))}
                />
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <header className="flex items-center gap-2 border-b border-gray-100 bg-[#f5f5f5] px-4 py-3">
              <Tags className="h-5 w-5 shrink-0" style={{ color: VERDE }} strokeWidth={2.25} aria-hidden />
              <h2 className="text-sm font-bold text-[#001f3f]">Ranking de Recomendações</h2>
            </header>
            <div className="grid gap-4 p-4 md:grid-cols-3">
              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase text-gray-500">
                  <Layers className="h-3.5 w-3.5" aria-hidden />
                  Categorias
                </h3>
                <ListaRankingNome
                  itens={d.recCategorias}
                  rotuloTotal="ind."
                  corPosicao={VERDE}
                  vazio="Sem recomendações por categoria."
                />
              </div>
              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase text-gray-500">
                  <Layers className="h-3.5 w-3.5" aria-hidden />
                  Subcategorias
                </h3>
                <ListaRankingNome
                  itens={d.recSubcategorias}
                  rotuloTotal="ind."
                  corPosicao={VERDE}
                  vazio="Sem recomendações por subcategoria."
                />
              </div>
              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase text-gray-500">
                  <Tags className="h-3.5 w-3.5" aria-hidden />
                  Marcas
                </h3>
                <ListaRankingNome
                  itens={d.recMarcas}
                  rotuloTotal="ind."
                  corPosicao={VERDE}
                  vazio="Sem recomendações por marca."
                />
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <header className="flex items-center gap-2 border-b border-gray-100 bg-[#f5f5f5] px-4 py-3">
              <BarChart3 className="h-5 w-5 shrink-0" style={{ color: AZUL }} strokeWidth={2.25} aria-hidden />
              <h2 className="text-sm font-bold text-[#001f3f]">Ranking de Categorias</h2>
            </header>
            <div className="grid gap-4 p-4 md:grid-cols-2">
              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase text-gray-500">
                  <Search className="h-3.5 w-3.5" aria-hidden />
                  Filtro · Categorias (popup)
                </h3>
                <ListaRankingNome itens={d.filtroCategorias} vazio="Nenhum filtro de categoria." />
              </div>
              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase text-gray-500">
                  <Search className="h-3.5 w-3.5" aria-hidden />
                  Filtro · Subcategorias (popup)
                </h3>
                <ListaRankingNome
                  itens={d.filtroSubcategorias}
                  vazio="Nenhum filtro de subcategoria."
                />
              </div>
              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase text-gray-500">
                  <Search className="h-3.5 w-3.5" aria-hidden />
                  Motor · Categorias (produto clicado)
                </h3>
                <ListaRankingNome itens={d.motorCategorias} vazio="Nenhum clique com categoria." />
              </div>
              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase text-gray-500">
                  <Search className="h-3.5 w-3.5" aria-hidden />
                  Motor · Subcategorias (produto clicado)
                </h3>
                <ListaRankingNome
                  itens={d.motorSubcategorias}
                  vazio="Nenhum clique com subcategoria."
                />
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <header className="flex items-center gap-2 border-b border-gray-100 bg-[#f5f5f5] px-4 py-3">
              <PieChart className="h-5 w-5 shrink-0" style={{ color: VERDE }} strokeWidth={2.25} aria-hidden />
              <h2 className="text-sm font-bold text-[#001f3f]">Gráficos</h2>
            </header>
            <div className="grid gap-4 p-4 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase text-gray-500">
                  Pizza — % por categoria
                </h3>
                <PizzaCategorias
                  fatias={d.pizzaBuscas}
                  vazio="Sem atividade por categoria neste período."
                />
              </div>
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase text-gray-500">
                  Lista — desempenho geral
                </h3>
                <ListaRankingNome
                  itens={d.listaDesempenhoCat}
                  rotuloTotal="evt."
                  vazio="Sem desempenho agregado."
                />
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
