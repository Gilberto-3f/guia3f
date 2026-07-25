'use client'

import { useEffect, useState } from 'react'
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
import { useDrenaCatalogo } from '@/app/[locale]/(app-shell)/dashboard/empresa/hooks/useDrenaCatalogo'
import { contarCliquesBotaoDinamicoMes } from '@/lib/botaoDinamicoCliques'
import type { PeriodoDrena } from '@/lib/drenaAnalytics'
import { supabase } from '@/lib/supabase'

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
 * Feedback do catálogo (mesmo modelo da aba Catálogo do Drena-Stok).
 * Usado na aba AJUSTES do Botão Dinâmico para lojas.
 */
export default function FeedbackCatalogoAjustes({
  empresaId,
  abertoInicial = false,
  rotuloBotaoDinamico = 'CATÁLOGO',
}: Props) {
  const cat = useDrenaCatalogo(empresaId)
  const [feedbackAberto, setFeedbackAberto] = useState(abertoInicial)
  const [cliquesMes, setCliquesMes] = useState<number | null>(null)

  useEffect(() => {
    if (!empresaId) return
    let ativo = true
    void (async () => {
      const total = await contarCliquesBotaoDinamicoMes(supabase, empresaId)
      if (ativo) setCliquesMes(total)
    })()
    return () => {
      ativo = false
    }
  }, [empresaId])

  return (
    <div className="space-y-3">
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
        <div className="h-40 animate-pulse rounded-xl bg-gray-100" />
      ) : cat.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {cat.error.message}
        </div>
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
              valor={cat.produtos.length}
              sufixo="produtos cadastrados"
            />
            <FeedbackLinha
              icone={MousePointerClick}
              titulo="Cliques"
              valor={cat.totalCliques}
              sufixo="nos produtos"
            />
            <FeedbackLinha
              icone={Eye}
              corIcone="#9ca3af"
              titulo="Impressões"
              valor={cat.totalImpressoes}
              sufixo="visualizações"
            />
            <FeedbackLinha
              icone={ThumbsUp}
              corIcone={VERDE}
              titulo="Indicações"
              valor={cat.totalRecomendacoes}
              sufixo="de produtos"
            />
            <FeedbackLinha
              icone={Bookmark}
              titulo="Favoritos"
              valor={cat.totalFavoritos}
              sufixo="produtos salvos"
            />
            <FeedbackLinha
              icone={Repeat2}
              titulo="Repostados"
              valor={cat.totalRepostados}
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
