'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  BarChart3,
  Bookmark,
  Eye,
  MessageSquareQuote,
  MousePointerClick,
  Package,
  Repeat2,
  ThumbsUp,
} from 'lucide-react'
import ChevronPasta from '@/app/[locale]/(app-shell)/empresa/components/menu-empresa/hospedagem/ChevronPasta'
import { contarCliquesBotaoDinamicoMes } from '@/lib/botaoDinamicoCliques'
import { supabase } from '@/lib/supabase'
import { inicioPeriodoIso, type PeriodoDrena } from '@/lib/drenaAnalytics'

const VERDE = '#00D443'
const AZUL = '#0097b2'

const PERIODOS: { id: PeriodoDrena; label: string }[] = [
  { id: '24h', label: '24h' },
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' },
]

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

type Props = {
  empresaId: string
  abertoInicial?: boolean
  rotuloBotaoDinamico?: string
}

/**
 * Feedback dos serviços (AJUSTES) — espelho do Feedback do catálogo.
 */
export default function FeedbackServicosAjustes({
  empresaId,
  abertoInicial = false,
  rotuloBotaoDinamico = 'SERVIÇOS',
}: Props) {
  const [periodo, setPeriodo] = useState<PeriodoDrena>('7d')
  const [feedbackAberto, setFeedbackAberto] = useState(abertoInicial)
  const [loading, setLoading] = useState(true)
  const [totalItens, setTotalItens] = useState(0)
  const [totalCliques, setTotalCliques] = useState(0)
  const [totalImpressoes, setTotalImpressoes] = useState(0)
  const [totalRecs, setTotalRecs] = useState(0)
  const [totalFavs, setTotalFavs] = useState(0)
  const [totalReposts, setTotalReposts] = useState(0)
  const [cliquesMes, setCliquesMes] = useState<number | null>(null)

  const carregar = useCallback(async () => {
    if (!empresaId) return
    setLoading(true)
    try {
      const desde = inicioPeriodoIso(periodo)

      const { data: servicos } = await supabase
        .from('servicos_locais_itens')
        .select('id')
        .eq('empresa_id', empresaId)
        .eq('ativo', true)
      const ids = (servicos ?? []).map((p) => String(p.id)).filter(Boolean)
      setTotalItens(ids.length)

      // Cliques/impressões por serviço ainda sem tabela dedicada — mantém slot alinhado (0).
      setTotalCliques(0)
      setTotalImpressoes(0)

      const { count: recCount } = await supabase
        .from('recomendacoes_servico')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', empresaId)
        .gte('created_at', desde)
      setTotalRecs(recCount ?? 0)

      let favs = 0
      if (ids.length) {
        const { count } = await supabase
          .from('favoritos')
          .select('id', { count: 'exact', head: true })
          .eq('alvo_tipo', 'servico')
          .in('alvo_id', ids)
          .gte('created_at', desde)
        favs = count ?? 0
      }
      setTotalFavs(favs)

      const { data: posts } = await supabase
        .from('posts')
        .select('id')
        .eq('empresa_id', empresaId)
        .eq('tipo', 'catalogo_servicos')
        .gte('created_at', desde)
      const postIds = (posts ?? []).map((p) => String(p.id)).filter(Boolean)
      let rep = 0
      if (postIds.length) {
        const { count } = await supabase
          .from('reposts')
          .select('id', { count: 'exact', head: true })
          .in('post_id', postIds)
          .gte('created_at', desde)
        rep = count ?? 0
      }
      setTotalReposts(rep)

      const mes = await contarCliquesBotaoDinamicoMes(supabase, empresaId)
      setCliquesMes(mes)
    } catch (e) {
      console.warn('[FeedbackServicosAjustes]', e)
      setTotalItens(0)
      setTotalCliques(0)
      setTotalImpressoes(0)
      setTotalRecs(0)
      setTotalFavs(0)
      setTotalReposts(0)
      setCliquesMes(0)
    } finally {
      setLoading(false)
    }
  }, [empresaId, periodo])

  useEffect(() => {
    void carregar()
  }, [carregar])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-center gap-2">
        {PERIODOS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriodo(p.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              periodo === p.id
                ? 'bg-[#0097b2] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-xl bg-gray-100" />
      ) : (
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
              titulo="Itens cadastrados"
              valor={totalItens}
              sufixo="serviços cadastrados"
            />
            <FeedbackLinha
              icone={MousePointerClick}
              titulo="Cliques"
              valor={totalCliques}
              sufixo="nos serviços"
            />
            <FeedbackLinha
              icone={Eye}
              corIcone="#9ca3af"
              titulo="Impressões"
              valor={totalImpressoes}
              sufixo="visualizações"
            />
            <FeedbackLinha
              icone={ThumbsUp}
              corIcone={VERDE}
              titulo="Indicações"
              valor={totalRecs}
              sufixo="de serviços"
            />
            <FeedbackLinha
              icone={Bookmark}
              titulo="Favoritos"
              valor={totalFavs}
              sufixo="serviços salvos"
            />
            <FeedbackLinha
              icone={Repeat2}
              titulo="Repostados"
              valor={totalReposts}
              sufixo="no feed"
            />
            <FeedbackLinha
              icone={BarChart3}
              titulo="Desempenho"
              valor={cliquesMes == null ? '—' : cliquesMes}
              sufixo={`Cliques no botão dinâmico "${rotuloBotaoDinamico}" (mês corrente)`}
            />
          </div>
        </ChevronPasta>
      )}
    </div>
  )
}
