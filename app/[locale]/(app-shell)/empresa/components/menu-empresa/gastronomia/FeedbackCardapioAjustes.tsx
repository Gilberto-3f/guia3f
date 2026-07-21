'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Bookmark,
  MessageSquareQuote,
  Repeat2,
  ThumbsUp,
  Utensils,
} from 'lucide-react'
import ChevronPasta from '@/app/[locale]/(app-shell)/empresa/components/menu-empresa/hospedagem/ChevronPasta'
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
  icone: typeof Utensils
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
}

/**
 * Feedback do cardápio (AJUSTES gastronomia) — espelho do Feedback do catálogo.
 */
export default function FeedbackCardapioAjustes({
  empresaId,
  abertoInicial = false,
}: Props) {
  const [periodo, setPeriodo] = useState<PeriodoDrena>('7d')
  const [feedbackAberto, setFeedbackAberto] = useState(abertoInicial)
  const [loading, setLoading] = useState(true)
  const [totalPratos, setTotalPratos] = useState(0)
  const [totalRecs, setTotalRecs] = useState(0)
  const [totalFavs, setTotalFavs] = useState(0)
  const [totalReposts, setTotalReposts] = useState(0)

  const carregar = useCallback(async () => {
    if (!empresaId) return
    setLoading(true)
    try {
      const desde = inicioPeriodoIso(periodo)

      const { data: pratos } = await supabase
        .from('cardapio_pratos')
        .select('id')
        .eq('empresa_id', empresaId)
        .eq('ativo', true)
      const ids = (pratos ?? []).map((p) => String(p.id)).filter(Boolean)
      setTotalPratos(ids.length)

      const { count: recCount } = await supabase
        .from('recomendacoes_prato')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', empresaId)
        .gte('created_at', desde)
      setTotalRecs(recCount ?? 0)

      let favs = 0
      if (ids.length) {
        const { count } = await supabase
          .from('favoritos')
          .select('id', { count: 'exact', head: true })
          .eq('alvo_tipo', 'prato')
          .in('alvo_id', ids)
          .gte('created_at', desde)
        favs = count ?? 0
      }
      setTotalFavs(favs)

      const { data: posts } = await supabase
        .from('posts')
        .select('id')
        .eq('empresa_id', empresaId)
        .eq('tipo', 'catalogo_cardapio')
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
    } catch (e) {
      console.warn('[FeedbackCardapioAjustes]', e)
      setTotalPratos(0)
      setTotalRecs(0)
      setTotalFavs(0)
      setTotalReposts(0)
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
              icone={Utensils}
              titulo="Cardápio"
              valor={totalPratos}
              sufixo="pratos cadastrados"
            />
            <FeedbackLinha
              icone={ThumbsUp}
              corIcone={VERDE}
              titulo="Indicações"
              valor={totalRecs}
              sufixo="de pratos"
            />
            <FeedbackLinha
              icone={Bookmark}
              titulo="Favoritos"
              valor={totalFavs}
              sufixo="pratos salvos"
            />
            <FeedbackLinha
              icone={Repeat2}
              titulo="Repostados"
              valor={totalReposts}
              sufixo="no feed"
            />
          </div>
        </ChevronPasta>
      )}
    </div>
  )
}
