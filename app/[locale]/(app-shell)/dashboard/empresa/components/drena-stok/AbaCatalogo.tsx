'use client'

import { useState } from 'react'
import {
  Award,
  Bookmark,
  Eye,
  MessageSquareQuote,
  MousePointerClick,
  Package,
  PieChart,
  Repeat2,
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

function FeedbackLinha({
  icone: Icone,
  corIcone,
  titulo,
  valor,
  sufixo,
}: {
  icone: typeof Package
  corIcone?: string
  titulo: string
  valor: number | string
  sufixo?: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-[#f5f5f5] px-3 py-3">
      <Icone className="h-5 w-5 shrink-0" style={{ color: corIcone ?? AZUL }} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{titulo}</p>
        {sufixo ? <p className="text-[10px] text-gray-400">{sufixo}</p> : null}
      </div>
      <p className="text-lg font-bold tabular-nums text-[#001f3f]">{valor}</p>
    </div>
  )
}

/** Catálogo — desempenho dos produtos da empresa. */
export default function AbaCatalogo({ empresaId }: Props) {
  const cat = useDrenaCatalogo(empresaId)
  const [feedbackAberto, setFeedbackAberto] = useState(false)
  const [rankingAberto, setRankingAberto] = useState(false)
  const [recsAberto, setRecsAberto] = useState(false)

  const [procuradosAberto, setProcuradosAberto] = useState(false)
  const [catBuscadaAberto, setCatBuscadaAberto] = useState(false)
  const [catsProcurados, setCatsProcurados] = useState<Record<string, boolean>>({})

  const [recomendadosAberto, setRecomendadosAberto] = useState(false)
  const [catsRecAberto, setCatsRecAberto] = useState(false)
  const [catsRecomendados, setCatsRecomendados] = useState<Record<string, boolean>>({})

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
            <div className="space-y-2">
              <FeedbackLinha
                icone={Package}
                titulo="Catálogo"
                valor={cat.produtos.length}
                sufixo="produtos"
              />
              <FeedbackLinha icone={MousePointerClick} titulo="Cliques" valor={cat.totalCliques} />
              <FeedbackLinha icone={Eye} corIcone="#9ca3af" titulo="Impressões" valor={cat.totalImpressoes} />
              <FeedbackLinha
                icone={ThumbsUp}
                corIcone={VERDE}
                titulo="Indicações"
                valor={cat.totalRecomendacoes}
              />
              <FeedbackLinha icone={Bookmark} titulo="Favoritos" valor={cat.totalFavoritos} />
              <FeedbackLinha icone={Repeat2} titulo="Repostados" valor={cat.totalRepostados} />
            </div>
          </ChevronPasta>

          <ChevronPasta
            titulo="Ranking do Catálogo"
            aberto={rankingAberto}
            onToggle={() => setRankingAberto((v) => !v)}
            icone={Award}
            corTitulo={AZUL}
          >
            <div className="space-y-3">
              <ChevronPasta
                titulo="Produtos mais procurados"
                aberto={procuradosAberto}
                onToggle={() => setProcuradosAberto((v) => !v)}
                icone={MousePointerClick}
                corTitulo={AZUL}
              >
                {cat.secoesPorCliques.length === 0 ? (
                  <p className="rounded-lg bg-gray-50 py-6 text-center text-sm text-gray-400">
                    Nenhum clique nos seus produtos neste período.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {cat.secoesPorCliques.map((sec) => {
                      const Icone = iconeCategoriaProduto(sec.categoriaNome)
                      const abertoCat = Boolean(catsProcurados[sec.categoriaId])
                      return (
                        <ChevronPasta
                          key={sec.categoriaId}
                          titulo={`${sec.categoriaNome} · ${sec.totalCliques} cliques`}
                          aberto={abertoCat}
                          onToggle={() =>
                            setCatsProcurados((a) => ({
                              ...a,
                              [sec.categoriaId]: !a[sec.categoriaId],
                            }))
                          }
                          icone={Icone}
                          corTitulo={AZUL}
                        >
                          <ul className="space-y-2">
                            {sec.produtos.map((p, i) => (
                              <li key={p.id}>
                                <MiniCardRankingProduto posicao={i + 1} item={p} modo="cliques" />
                              </li>
                            ))}
                          </ul>
                        </ChevronPasta>
                      )
                    })}
                  </div>
                )}
              </ChevronPasta>

              <ChevronPasta
                titulo="Categoria mais buscada"
                aberto={catBuscadaAberto}
                onToggle={() => setCatBuscadaAberto((v) => !v)}
                icone={PieChart}
                corTitulo={AZUL}
              >
                <PizzaCategorias
                  fatias={cat.pizzaCliques}
                  vazio="Sem cliques por categoria neste período."
                />
              </ChevronPasta>
            </div>
          </ChevronPasta>

          <ChevronPasta
            titulo="Ranking de Recomendações"
            aberto={recsAberto}
            onToggle={() => setRecsAberto((v) => !v)}
            icone={ThumbsUp}
            corTitulo={VERDE}
          >
            <div className="space-y-3">
              <ChevronPasta
                titulo="Produtos mais recomendados"
                aberto={recomendadosAberto}
                onToggle={() => setRecomendadosAberto((v) => !v)}
                icone={ThumbsUp}
                corTitulo={VERDE}
              >
                {cat.secoesPorRecomendacoes.length === 0 ? (
                  <p className="rounded-lg bg-gray-50 py-6 text-center text-sm text-gray-400">
                    Nenhuma indicação de produto neste período.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {cat.secoesPorRecomendacoes.map((sec) => {
                      const Icone = iconeCategoriaProduto(sec.categoriaNome)
                      const abertoCat = Boolean(catsRecomendados[sec.categoriaId])
                      return (
                        <ChevronPasta
                          key={sec.categoriaId}
                          titulo={`${sec.categoriaNome} · ${sec.totalRecomendacoes} indicações`}
                          aberto={abertoCat}
                          onToggle={() =>
                            setCatsRecomendados((a) => ({
                              ...a,
                              [sec.categoriaId]: !a[sec.categoriaId],
                            }))
                          }
                          icone={Icone}
                          corTitulo={VERDE}
                        >
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
                        </ChevronPasta>
                      )
                    })}
                  </div>
                )}
              </ChevronPasta>

              <ChevronPasta
                titulo="Categorias mais recomendadas"
                aberto={catsRecAberto}
                onToggle={() => setCatsRecAberto((v) => !v)}
                icone={PieChart}
                corTitulo={VERDE}
              >
                <PizzaCategorias
                  fatias={cat.pizzaRecomendacoes}
                  vazio="Sem recomendações por categoria neste período."
                />
              </ChevronPasta>
            </div>
          </ChevronPasta>
        </>
      )}
    </div>
  )
}
