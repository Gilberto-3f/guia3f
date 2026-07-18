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
import ChevronPasta from '@/app/[locale]/(app-shell)/empresa/components/menu-empresa/hospedagem/ChevronPasta'
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

type AbaRanking100 = 'turistas' | 'profissionais'

/** Compras CDE — analíticos do mercado geral. */
export default function AbaComprasCde() {
  const d = useDrenaComprasCde()
  const [gruposTur, setGruposTur] = useState(1)
  const [gruposProf, setGruposProf] = useState(1)
  const [abaRanking, setAbaRanking] = useState<AbaRanking100>('turistas')
  const [rankingAberto, setRankingAberto] = useState(true)
  const [recsAberto, setRecsAberto] = useState(true)
  const [catsAberto, setCatsAberto] = useState(true)
  const [graficosAberto, setGraficosAberto] = useState(true)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-center gap-2">
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
          <ChevronPasta
            titulo="Ranking 100+"
            aberto={rankingAberto}
            onToggle={() => setRankingAberto((v) => !v)}
            icone={Hash}
            corTitulo={AZUL}
          >
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                Top 100 palavras-chave do motor de busca · 5 grupos de 20.
              </p>
              <div className="flex gap-1 rounded-lg bg-gray-100 p-1" role="tablist" aria-label="Perfil ranking">
                <button
                  type="button"
                  role="tab"
                  aria-selected={abaRanking === 'turistas'}
                  onClick={() => setAbaRanking('turistas')}
                  className={`flex-1 rounded-md px-3 py-2 text-xs font-bold transition sm:text-sm ${
                    abaRanking === 'turistas'
                      ? 'bg-[#0097b2] text-white shadow-sm'
                      : 'text-gray-600 hover:bg-white/70'
                  }`}
                >
                  Turistas
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={abaRanking === 'profissionais'}
                  onClick={() => setAbaRanking('profissionais')}
                  className={`flex-1 rounded-md px-3 py-2 text-xs font-bold transition sm:text-sm ${
                    abaRanking === 'profissionais'
                      ? 'bg-[#0097b2] text-white shadow-sm'
                      : 'text-gray-600 hover:bg-white/70'
                  }`}
                >
                  Profissionais
                </button>
              </div>
              {abaRanking === 'turistas' ? (
                <Ranking100Grupos
                  titulo="Turistas"
                  ocultarTitulo
                  grupos={d.gruposTuristas}
                  gruposLiberados={gruposTur}
                  onLiberarProximo={() => setGruposTur((n) => Math.min(5, n + 1))}
                />
              ) : (
                <Ranking100Grupos
                  titulo="Profissionais"
                  ocultarTitulo
                  grupos={d.gruposProfissionais}
                  gruposLiberados={gruposProf}
                  onLiberarProximo={() => setGruposProf((n) => Math.min(5, n + 1))}
                />
              )}
            </div>
          </ChevronPasta>

          <ChevronPasta
            titulo="Ranking de Recomendações"
            aberto={recsAberto}
            onToggle={() => setRecsAberto((v) => !v)}
            icone={Tags}
            corTitulo={VERDE}
          >
            <div className="grid gap-4 md:grid-cols-3">
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
          </ChevronPasta>

          <ChevronPasta
            titulo="Ranking de Categorias"
            aberto={catsAberto}
            onToggle={() => setCatsAberto((v) => !v)}
            icone={BarChart3}
            corTitulo={AZUL}
          >
            <div className="grid gap-4 md:grid-cols-2">
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
          </ChevronPasta>

          <ChevronPasta
            titulo="Gráficos"
            aberto={graficosAberto}
            onToggle={() => setGraficosAberto((v) => !v)}
            icone={PieChart}
            corTitulo={VERDE}
          >
            <div className="grid gap-4 lg:grid-cols-2">
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
          </ChevronPasta>
        </>
      )}
    </div>
  )
}
