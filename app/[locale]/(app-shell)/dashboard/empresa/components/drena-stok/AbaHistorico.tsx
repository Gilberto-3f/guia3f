'use client'

import { useState } from 'react'
import {
  Archive,
  BarChart3,
  CalendarRange,
  FileSearch,
  Hash,
  Search,
  Tags,
  type LucideIcon,
} from 'lucide-react'
import ChevronPasta from '@/app/[locale]/(app-shell)/empresa/components/menu-empresa/hospedagem/ChevronPasta'
import { useDrenaHistoricoArquivo } from '../../hooks/useDrenaHistoricoArquivo'
import {
  useDrenaLinhaTempo,
  type PontoMesLinha,
  type TipoFiltroLinha,
} from '../../hooks/useDrenaLinhaTempo'
import Ranking100Grupos from './Ranking100Grupos'
import ListaRankingNome from './ListaRankingNome'
import PizzaCategorias from './PizzaCategorias'
import type { TermoRanking } from '@/lib/drenaAnalytics'

const VERDE = '#00D443'
const AZUL = '#0097b2'
const CINZA = '#666666'

type SubAba = 'arquivo' | 'linha'

const SUBS: { id: SubAba; label: string; Icon: LucideIcon }[] = [
  { id: 'arquivo', label: 'Arquivo', Icon: Archive },
  { id: 'linha', label: 'Linha do Tempo', Icon: CalendarRange },
]

const TIPOS_FILTRO: { id: TipoFiltroLinha; label: string }[] = [
  { id: 'palavra', label: 'Palavra-chave' },
  { id: 'categoria', label: 'Categoria' },
  { id: 'subcategoria', label: 'Subcategoria' },
  { id: 'marca', label: 'Marca' },
]

function chunkTermos(ranking: TermoRanking[], tamanho = 20): TermoRanking[][] {
  const grupos: TermoRanking[][] = []
  for (let i = 0; i < ranking.length; i += tamanho) {
    grupos.push(ranking.slice(i, i + tamanho))
  }
  while (grupos.length < 5) grupos.push([])
  return grupos.slice(0, 5)
}

function SerieTriplaSvg({ serie }: { serie: PontoMesLinha[] }) {
  if (!serie.length) return null

  const w = 360
  const h = 140
  const pad = 18
  const max = Math.max(
    1,
    ...serie.flatMap((p) => [p.filtro, p.motor, p.recomendacoes]),
  )

  const pontos = (chave: 'filtro' | 'motor' | 'recomendacoes') =>
    serie
      .map((p, i) => {
        const x = pad + (i * (w - pad * 2)) / Math.max(serie.length - 1, 1)
        const y = h - pad - (p[chave] / max) * (h - pad * 2)
        return `${x},${y}`
      })
      .join(' ')

  return (
    <div>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} className="max-w-full">
        <polyline fill="none" stroke={CINZA} strokeWidth="2" points={pontos('filtro')} />
        <polyline fill="none" stroke={AZUL} strokeWidth="2.5" points={pontos('motor')} />
        <polyline fill="none" stroke={VERDE} strokeWidth="2.5" points={pontos('recomendacoes')} />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-gray-400">
        <span>{serie[0]?.label}</span>
        <span>{serie[serie.length - 1]?.label}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[10px] font-semibold uppercase tracking-wide">
        <span className="inline-flex items-center gap-1.5" style={{ color: CINZA }}>
          <span className="inline-block h-2 w-2 rounded-full bg-[#666666]" /> Filtro
        </span>
        <span className="inline-flex items-center gap-1.5" style={{ color: AZUL }}>
          <span className="inline-block h-2 w-2 rounded-full bg-[#0097b2]" /> Motor
        </span>
        <span className="inline-flex items-center gap-1.5" style={{ color: VERDE }}>
          <span className="inline-block h-2 w-2 rounded-full bg-[#00D443]" /> Recomendações
        </span>
      </div>
    </div>
  )
}

function PainelArquivo() {
  const arq = useDrenaHistoricoArquivo()
  const [gruposTur, setGruposTur] = useState(1)
  const [gruposProf, setGruposProf] = useState(1)
  const [r100Aberto, setR100Aberto] = useState(false)
  const [recsAberto, setRecsAberto] = useState(false)
  const [catsAberto, setCatsAberto] = useState(false)
  const [grafAberto, setGrafAberto] = useState(false)

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
          <ChevronPasta
            titulo="1 · Ranking 100+"
            aberto={r100Aberto}
            onToggle={() => setR100Aberto((v) => !v)}
            icone={Hash}
            corTitulo={AZUL}
          >
            <div className="space-y-3">
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
          </ChevronPasta>

          <ChevronPasta
            titulo="2 · Ranking de Recomendações"
            aberto={recsAberto}
            onToggle={() => setRecsAberto((v) => !v)}
            icone={Tags}
            corTitulo={VERDE}
          >
            <div className="space-y-4">
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase text-gray-500">Categorias</h3>
                <ListaRankingNome
                  itens={p.recomendacoes?.categorias ?? []}
                  rotuloTotal="ind."
                  corPosicao={VERDE}
                />
              </div>
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase text-gray-500">Subcategorias</h3>
                <ListaRankingNome
                  itens={p.recomendacoes?.subcategorias ?? []}
                  rotuloTotal="ind."
                  corPosicao={VERDE}
                />
              </div>
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase text-gray-500">Marcas</h3>
                <ListaRankingNome
                  itens={p.recomendacoes?.marcas ?? []}
                  rotuloTotal="ind."
                  corPosicao={VERDE}
                />
              </div>
            </div>
          </ChevronPasta>

          <ChevronPasta
            titulo="3 · Ranking de Categorias"
            aberto={catsAberto}
            onToggle={() => setCatsAberto((v) => !v)}
            icone={BarChart3}
            corTitulo={AZUL}
          >
            <div className="space-y-4">
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase text-gray-500">Filtro · Categorias</h3>
                <ListaRankingNome itens={p.categorias?.filtroCategorias ?? []} />
              </div>
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase text-gray-500">
                  Filtro · Subcategorias
                </h3>
                <ListaRankingNome itens={p.categorias?.filtroSubcategorias ?? []} />
              </div>
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase text-gray-500">Motor · Categorias</h3>
                <ListaRankingNome itens={p.categorias?.motorCategorias ?? []} />
              </div>
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase text-gray-500">
                  Motor · Subcategorias
                </h3>
                <ListaRankingNome itens={p.categorias?.motorSubcategorias ?? []} />
              </div>
            </div>
          </ChevronPasta>

          <ChevronPasta
            titulo="4 · Gráficos"
            aberto={grafAberto}
            onToggle={() => setGrafAberto((v) => !v)}
            icone={BarChart3}
            corTitulo={VERDE}
          >
            <div className="space-y-4">
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase text-gray-500">Pizza</h3>
                <PizzaCategorias fatias={p.graficos?.pizza ?? []} />
              </div>
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase text-gray-500">Lista · desempenho</h3>
                <ListaRankingNome itens={p.graficos?.listaDesempenho ?? []} rotuloTotal="evt." />
              </div>
            </div>
          </ChevronPasta>

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

function PainelLinhaTempo() {
  const lt = useDrenaLinhaTempo()
  const [motorAberto, setMotorAberto] = useState(false)
  const [relAberto, setRelAberto] = useState(false)
  const anos = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

  const opcoesValor =
    lt.tipo === 'categoria'
      ? lt.categorias
      : lt.tipo === 'subcategoria'
        ? lt.subcategorias
        : lt.tipo === 'marca'
          ? lt.marcas
          : []

  return (
    <div className="space-y-4">
      <ChevronPasta
        titulo="Motor de busca"
        aberto={motorAberto}
        onToggle={() => setMotorAberto((v) => !v)}
        icone={FileSearch}
        corTitulo={AZUL}
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Escolha um filtro por vez (palavra-chave, categoria, subcategoria ou marca) e o mês/ano de
            início. O relatório cobre até os últimos 12 meses até hoje.
          </p>

          <div className="flex flex-wrap gap-2">
            {TIPOS_FILTRO.map((t) => {
              const ativa = lt.tipo === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    lt.setTipo(t.id)
                    lt.setValorId('')
                    lt.setValorTexto('')
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    ativa
                      ? 'bg-[#0097b2] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t.label}
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            {lt.tipo === 'palavra' ? (
              <label className="min-w-[200px] flex-1 text-xs font-semibold text-gray-600">
                Palavra-chave
                <input
                  type="search"
                  value={lt.valorTexto}
                  onChange={(e) => lt.setValorTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void lt.buscar()
                  }}
                  placeholder="Ex: iphone"
                  className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-[#001f3f]"
                />
              </label>
            ) : (
              <label className="min-w-[200px] flex-1 text-xs font-semibold text-gray-600">
                {TIPOS_FILTRO.find((t) => t.id === lt.tipo)?.label}
                <select
                  value={lt.valorId}
                  onChange={(e) => lt.setValorId(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-[#001f3f]"
                >
                  <option value="">Selecione…</option>
                  {opcoesValor.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nome}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="text-xs font-semibold text-gray-600">
              Mês início
              <select
                value={lt.mesIni}
                onChange={(e) => lt.setMesIni(Number(e.target.value))}
                className="mt-1 block rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-[#001f3f]"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {lt.labelMes(m)}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold text-gray-600">
              Ano início
              <select
                value={lt.anoIni}
                onChange={(e) => lt.setAnoIni(Number(e.target.value))}
                className="mt-1 block rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-[#001f3f]"
              >
                {anos.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => void lt.buscar()}
              disabled={lt.buscando}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white shadow-sm disabled:opacity-50"
              style={{ backgroundColor: VERDE }}
            >
              <Search className="h-4 w-4" strokeWidth={2.25} aria-hidden />
              {lt.buscando ? 'Buscando…' : 'Buscar'}
            </button>
          </div>

          {lt.erro ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {lt.erro}
            </div>
          ) : null}
        </div>
      </ChevronPasta>

      {lt.buscando ? (
        <div className="h-40 animate-pulse rounded-xl bg-gray-100" />
      ) : lt.relatorio ? (
        <ChevronPasta
          titulo={`Relatório de Pesquisa · ${lt.relatorio.rotulo}`}
          aberto={relAberto}
          onToggle={() => setRelAberto((v) => !v)}
          icone={BarChart3}
          corTitulo={VERDE}
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg bg-[#f5f5f5] px-3 py-3">
                <p className="text-[10px] font-bold uppercase text-gray-500">Filtro</p>
                <p className="text-xl font-bold tabular-nums text-[#666666]">
                  {lt.relatorio.resumo.filtro.toLocaleString('pt-BR')}
                </p>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-[#f5f5f5] px-3 py-3">
                <p className="text-[10px] font-bold uppercase text-gray-500">Motor</p>
                <p className="text-xl font-bold tabular-nums" style={{ color: AZUL }}>
                  {lt.relatorio.resumo.motor.toLocaleString('pt-BR')}
                </p>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-[#f5f5f5] px-3 py-3">
                <p className="text-[10px] font-bold uppercase text-gray-500">Recomendações</p>
                <p className="text-xl font-bold tabular-nums" style={{ color: VERDE }}>
                  {lt.relatorio.resumo.recomendacoes.toLocaleString('pt-BR')}
                </p>
              </div>
            </div>

            <SerieTriplaSvg serie={lt.relatorio.serie} />

            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-[10px] uppercase text-gray-400">
                    <th className="py-2 pr-2 font-semibold">Mês</th>
                    <th className="py-2 px-2 text-right font-semibold">Filtro</th>
                    <th className="py-2 px-2 text-right font-semibold">Motor</th>
                    <th className="py-2 pl-2 text-right font-semibold">Rec.</th>
                  </tr>
                </thead>
                <tbody>
                  {lt.relatorio.serie.map((p) => (
                    <tr key={p.label} className="border-b border-gray-50 text-[#001f3f]">
                      <td className="py-1.5 pr-2 font-medium">{p.label}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-gray-600">
                        {p.filtro.toLocaleString('pt-BR')}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums" style={{ color: AZUL }}>
                        {p.motor.toLocaleString('pt-BR')}
                      </td>
                      <td className="py-1.5 pl-2 text-right tabular-nums" style={{ color: VERDE }}>
                        {p.recomendacoes.toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </ChevronPasta>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-10 text-center">
          <FileSearch className="mx-auto h-8 w-8 text-gray-300" strokeWidth={1.75} aria-hidden />
          <p className="mt-2 text-sm font-medium text-gray-600">Relatório de Pesquisa</p>
          <p className="mt-1 text-xs text-gray-400">
            Defina o filtro e clique em Buscar para ver a evolução (máx. 12 meses).
          </p>
        </div>
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

      {sub === 'arquivo' ? <PainelArquivo /> : <PainelLinhaTempo />}
    </div>
  )
}
