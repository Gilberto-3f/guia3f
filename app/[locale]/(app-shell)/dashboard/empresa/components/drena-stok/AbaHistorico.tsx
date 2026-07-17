'use client'

import { useState } from 'react'
import {
  Archive,
  BarChart3,
  CalendarRange,
  FileSearch,
  Hash,
  Tags,
  type LucideIcon,
} from 'lucide-react'
import { useDrenaHistoricoArquivo } from '../../hooks/useDrenaHistoricoArquivo'
import Ranking100Grupos from './Ranking100Grupos'
import ListaRankingNome from './ListaRankingNome'
import PizzaCategorias from './PizzaCategorias'
import type { TermoRanking } from '@/lib/drenaAnalytics'

const VERDE = '#00D443'
const AZUL = '#0097b2'

type SubAba = 'arquivo' | 'linha'

const SUBS: { id: SubAba; label: string; Icon: LucideIcon }[] = [
  { id: 'arquivo', label: 'Arquivo', Icon: Archive },
  { id: 'linha', label: 'Linha do Tempo', Icon: CalendarRange },
]

function chunkTermos(ranking: TermoRanking[], tamanho = 20): TermoRanking[][] {
  const grupos: TermoRanking[][] = []
  for (let i = 0; i < ranking.length; i += tamanho) {
    grupos.push(ranking.slice(i, i + tamanho))
  }
  while (grupos.length < 5) grupos.push([])
  return grupos.slice(0, 5)
}

function PainelArquivo() {
  const arq = useDrenaHistoricoArquivo()
  const [gruposTur, setGruposTur] = useState(1)
  const [gruposProf, setGruposProf] = useState(1)

  const p = arq.payload

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold text-gray-600">
          Mês / ano
          <select
            className="mt-1 block rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-[#001f3f]"
            value={`${arq.ano}-${arq.mes}`}
            onChange={(e) => {
              const [a, m] = e.target.value.split('-').map(Number)
              arq.selecionar(a, m)
              setGruposTur(1)
              setGruposProf(1)
            }}
          >
            {arq.opcoes.map((o) => (
              <option key={`${o.ano}-${o.mes}`} value={`${o.ano}-${o.mes}`}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {arq.fonte ? (
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
              arq.fonte === 'arquivo'
                ? 'bg-[#00D443]/15 text-[#00D443]'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {arq.fonte === 'arquivo' ? 'Snapshot congelado' : 'Prévia ao vivo'}
          </span>
        ) : null}
      </div>

      {arq.loading ? (
        <div className="h-40 animate-pulse rounded-xl bg-gray-100" />
      ) : arq.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {arq.error.message}
        </div>
      ) : !p ? (
        <p className="py-8 text-center text-sm text-gray-400">Sem dados para este mês.</p>
      ) : (
        <>
          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <header className="flex items-center gap-2 border-b border-gray-100 bg-[#f5f5f5] px-4 py-3">
              <Hash className="h-5 w-5 shrink-0" style={{ color: AZUL }} strokeWidth={2.25} aria-hidden />
              <h2 className="text-sm font-bold text-[#001f3f]">1 · Ranking 100+</h2>
            </header>
            <div className="grid gap-3 p-4 lg:grid-cols-2">
              <Ranking100Grupos
                titulo="Turistas"
                grupos={chunkTermos(p.ranking100?.turistas ?? [])}
                gruposLiberados={gruposTur}
                onLiberarProximo={() => setGruposTur((n) => Math.min(5, n + 1))}
              />
              <Ranking100Grupos
                titulo="Profissionais"
                grupos={chunkTermos(p.ranking100?.profissionais ?? [])}
                gruposLiberados={gruposProf}
                onLiberarProximo={() => setGruposProf((n) => Math.min(5, n + 1))}
              />
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <header className="flex items-center gap-2 border-b border-gray-100 bg-[#f5f5f5] px-4 py-3">
              <Tags className="h-5 w-5 shrink-0" style={{ color: VERDE }} strokeWidth={2.25} aria-hidden />
              <h2 className="text-sm font-bold text-[#001f3f]">2 · Ranking de Recomendações</h2>
            </header>
            <div className="grid gap-4 p-4 md:grid-cols-3">
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase text-gray-500">Categorias</h3>
                <ListaRankingNome itens={p.recomendacoes?.categorias ?? []} rotuloTotal="ind." corPosicao={VERDE} />
              </div>
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase text-gray-500">Subcategorias</h3>
                <ListaRankingNome itens={p.recomendacoes?.subcategorias ?? []} rotuloTotal="ind." corPosicao={VERDE} />
              </div>
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase text-gray-500">Marcas</h3>
                <ListaRankingNome itens={p.recomendacoes?.marcas ?? []} rotuloTotal="ind." corPosicao={VERDE} />
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <header className="flex items-center gap-2 border-b border-gray-100 bg-[#f5f5f5] px-4 py-3">
              <BarChart3 className="h-5 w-5 shrink-0" style={{ color: AZUL }} strokeWidth={2.25} aria-hidden />
              <h2 className="text-sm font-bold text-[#001f3f]">3 · Ranking de Categorias</h2>
            </header>
            <div className="grid gap-4 p-4 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase text-gray-500">Filtro · Categorias</h3>
                <ListaRankingNome itens={p.categorias?.filtroCategorias ?? []} />
              </div>
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase text-gray-500">Filtro · Subcategorias</h3>
                <ListaRankingNome itens={p.categorias?.filtroSubcategorias ?? []} />
              </div>
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase text-gray-500">Motor · Categorias</h3>
                <ListaRankingNome itens={p.categorias?.motorCategorias ?? []} />
              </div>
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase text-gray-500">Motor · Subcategorias</h3>
                <ListaRankingNome itens={p.categorias?.motorSubcategorias ?? []} />
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <header className="flex items-center gap-2 border-b border-gray-100 bg-[#f5f5f5] px-4 py-3">
              <BarChart3 className="h-5 w-5 shrink-0" style={{ color: VERDE }} strokeWidth={2.25} aria-hidden />
              <h2 className="text-sm font-bold text-[#001f3f]">4 · Gráficos</h2>
            </header>
            <div className="grid gap-4 p-4 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase text-gray-500">Pizza</h3>
                <PizzaCategorias fatias={p.graficos?.pizza ?? []} />
              </div>
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase text-gray-500">Lista · desempenho</h3>
                <ListaRankingNome itens={p.graficos?.listaDesempenho ?? []} rotuloTotal="evt." />
              </div>
            </div>
          </section>

          {p.gerado_em ? (
            <p className="text-center text-[10px] text-gray-400">
              Gerado em {new Date(p.gerado_em).toLocaleString('pt-BR')}
              {arq.fonte === 'live' ? ' · prévia (ainda não congelado pelo cron)' : ''}
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}

/** Histórico — Arquivo mensal + Linha do Tempo. */
export default function AbaHistorico() {
  const [sub, setSub] = useState<SubAba>('arquivo')

  return (
    <div className="space-y-4">
      <div className="flex gap-2" role="tablist" aria-label="Histórico Drena-Stok">
        {SUBS.map(({ id, label, Icon }) => {
          const ativa = sub === id
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={ativa}
              onClick={() => setSub(id)}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
                ativa ? 'text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
              style={ativa ? { backgroundColor: VERDE } : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
              <span className={ativa ? 'inline' : 'hidden sm:inline'}>{label}</span>
            </button>
          )
        })}
      </div>

      {sub === 'arquivo' ? (
        <PainelArquivo />
      ) : (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <header className="flex items-center gap-2 border-b border-gray-100 bg-[#f5f5f5] px-4 py-3">
            <FileSearch className="h-5 w-5 shrink-0 text-[#0097b2]" strokeWidth={2.25} aria-hidden />
            <h2 className="text-sm font-bold text-[#001f3f]">Linha do Tempo</h2>
          </header>
          <div className="space-y-3 p-4">
            <p className="text-xs text-gray-500">
              Filtro exclusivo: Palavra-chave · Categoria · Subcategoria · Marca + intervalo de datas →
              Relatório dos últimos 12 meses (Filtro / Motor / Recomendações).
            </p>
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-8 text-center">
              <FileSearch className="mx-auto h-8 w-8 text-gray-300" strokeWidth={1.75} aria-hidden />
              <p className="mt-2 text-sm font-medium text-gray-600">Motor de busca + Relatório de Pesquisa</p>
              <p className="mt-1 text-xs text-gray-400">Próxima fase.</p>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
