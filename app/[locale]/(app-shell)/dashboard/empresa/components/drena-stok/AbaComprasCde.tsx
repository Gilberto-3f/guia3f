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
import { useModalScrollLock } from '@/lib/useModalScrollLock'

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
  const [rankingAberto, setRankingAberto] = useState(false)
  const [recsAberto, setRecsAberto] = useState(false)
  const [catsAberto, setCatsAberto] = useState(false)
  const [catsFiltroAberto, setCatsFiltroAberto] = useState(false)
  const [catsMotorAberto, setCatsMotorAberto] = useState(false)
  const [graficosAberto, setGraficosAberto] = useState(false)
  const [infoDesempenhoAberto, setInfoDesempenhoAberto] = useState(false)
  useModalScrollLock(infoDesempenhoAberto)

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
              <p className="text-sm font-semibold text-[#001f3f]">
                {abaRanking === 'turistas'
                  ? 'Termos mais pesquisados por turistas'
                  : 'Termos mais pesquisados por profissionais'}
              </p>
              {abaRanking === 'turistas' ? (
                <Ranking100Grupos
                  titulo="Turistas"
                  ocultarTitulo
                  ocultarRotuloGrupo
                  grupos={d.gruposTuristas}
                  gruposLiberados={gruposTur}
                  onLiberarProximo={() => setGruposTur((n) => Math.min(5, n + 1))}
                />
              ) : (
                <Ranking100Grupos
                  titulo="Profissionais"
                  ocultarTitulo
                  ocultarRotuloGrupo
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
            <div className="space-y-3">
              <ChevronPasta
                titulo="Mais procurados pelo Filtro"
                aberto={catsFiltroAberto}
                onToggle={() => setCatsFiltroAberto((v) => !v)}
                icone={Search}
                corTitulo={AZUL}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h3 className="mb-2 text-xs font-bold uppercase text-gray-500">Categorias</h3>
                    <ListaRankingNome itens={d.filtroCategorias} vazio="Nenhuma categoria filtrada." />
                  </div>
                  <div>
                    <h3 className="mb-2 text-xs font-bold uppercase text-gray-500">Subcategorias</h3>
                    <ListaRankingNome
                      itens={d.filtroSubcategorias}
                      vazio="Nenhuma subcategoria filtrada."
                    />
                  </div>
                </div>
              </ChevronPasta>

              <ChevronPasta
                titulo="Mais procurados pelo Motor de Busca"
                aberto={catsMotorAberto}
                onToggle={() => setCatsMotorAberto((v) => !v)}
                icone={Search}
                corTitulo={VERDE}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h3 className="mb-2 text-xs font-bold uppercase text-gray-500">Categorias</h3>
                    <ListaRankingNome itens={d.motorCategorias} vazio="Nenhum clique com categoria." />
                  </div>
                  <div>
                    <h3 className="mb-2 text-xs font-bold uppercase text-gray-500">Subcategorias</h3>
                    <ListaRankingNome
                      itens={d.motorSubcategorias}
                      vazio="Nenhum clique com subcategoria."
                    />
                  </div>
                </div>
              </ChevronPasta>
            </div>
          </ChevronPasta>

          <ChevronPasta
            titulo="Desempenho Geral"
            aberto={graficosAberto}
            onToggle={() => setGraficosAberto((v) => !v)}
            icone={PieChart}
            corTitulo={VERDE}
            onInfo={() => setInfoDesempenhoAberto(true)}
            infoAriaLabel="Sobre o Desempenho Geral"
          >
            <div>
              <h3 className="mb-3 text-xs font-bold uppercase text-gray-500">
                Categorias com mais presença
              </h3>
              <PizzaCategorias
                fatias={d.pizzaBuscas}
                tamanho={220}
                vazio="Sem atividade por categoria neste período."
              />
            </div>
          </ChevronPasta>
        </>
      )}

      {infoDesempenhoAberto ? (
        <div
          className="fixed inset-0 z-[160] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setInfoDesempenhoAberto(false)
          }}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-t-2xl border border-gray-200 bg-white p-5 shadow-lg sm:rounded-2xl"
            role="dialog"
            aria-labelledby="info-desempenho-titulo"
            data-modal-scroll-lock-scrollable
          >
            <h3 id="info-desempenho-titulo" className="text-center text-base font-bold text-[#001f3f]">
              Desempenho Geral
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-gray-700">
              Gráfico apresenta a somatória de todas as pesquisas feitas nas buscas na{' '}
              <strong>barra de pesquisa</strong> e nos <strong>filtros das categorias</strong> (OBS: O
              ciclo de análise desse gráfico é mensal, acompanhando as buscas do primeiro dia do mês
              até o último.
            </p>
            <button
              type="button"
              onClick={() => setInfoDesempenhoAberto(false)}
              className="mt-4 w-full rounded-xl bg-[#0097b2] py-2.5 text-sm font-bold text-white"
            >
              Entendi
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
