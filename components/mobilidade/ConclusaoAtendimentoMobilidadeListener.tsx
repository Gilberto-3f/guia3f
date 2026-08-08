'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import PopupConclusaoAtendimentoMobilidade, {
  type FaseConclusaoUi,
} from '@/components/mobilidade/PopupConclusaoAtendimentoMobilidade'
import { MOBILIDADE_CORRIDA_ATIVA } from '@/lib/mobilidadeAtendimentoAtivoEventos'

type ConclusaoPendente = {
  solicitacao_id: string
  papel: 'profissional' | 'turista'
  fase: FaseConclusaoUi
  valor_corrida: number | null
  pagamento: string | null
  valor_regular: number | null
  bonus_voluntario: number | null
  ja_avaliou: boolean
}

function formatBrl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/**
 * Turista (e fallback do pro): popup verde de conclusão + avaliação após RECEBIDO/OK.
 */
export default function ConclusaoAtendimentoMobilidadeListener() {
  const t = useTranslations('Mobilidade')
  const { perfilEhProfissional, perfilEhTurista, perfilEhEmpresa, roleEfetivo, loading } =
    useProfissionalGate()
  const [conclusao, setConclusao] = useState<ConclusaoPendente | null>(null)
  const [fase, setFase] = useState<FaseConclusaoUi>('resumo')
  const [dismissedId, setDismissedId] = useState<string | null>(null)

  const elegivel =
    !loading &&
    (perfilEhTurista ||
      perfilEhEmpresa ||
      roleEfetivo === 'admin' ||
      perfilEhProfissional)

  const carregar = useCallback(async () => {
    if (!elegivel) return
    try {
      const res = await fetch('/api/mobilidade/conclusao-pendente')
      if (!res.ok) return
      const json = (await res.json()) as { conclusao?: ConclusaoPendente | null }
      const next = json.conclusao ?? null
      if (!next) {
        setConclusao(null)
        return
      }
      if (next.papel === 'profissional') return
      if (next.ja_avaliou) {
        setConclusao(null)
        return
      }
      if (dismissedId === next.solicitacao_id) return
      setConclusao(next)
      setFase(next.fase === 'avaliar' ? 'avaliar' : 'resumo')
    } catch {
      /* ignore */
    }
  }, [elegivel, dismissedId])

  useEffect(() => {
    if (!elegivel) return
    void carregar()
    const id = window.setInterval(() => void carregar(), 5_000)
    const onRefresh = () => void carregar()
    window.addEventListener(MOBILIDADE_CORRIDA_ATIVA, onRefresh)
    return () => {
      window.clearInterval(id)
      window.removeEventListener(MOBILIDADE_CORRIDA_ATIVA, onRefresh)
    }
  }, [elegivel, carregar])

  if (!conclusao) return null

  const valorTexto =
    conclusao.valor_corrida != null && Number.isFinite(conclusao.valor_corrida)
      ? formatBrl(conclusao.valor_corrida)
      : null

  const detalhes: string[] = []
  if (conclusao.pagamento) {
    try {
      detalhes.push(
        `${t('formaPagamento')}: ${t(`pag.${conclusao.pagamento}` as 'pag.dinheiro')}`,
      )
    } catch {
      detalhes.push(`${t('formaPagamento')}: ${conclusao.pagamento}`)
    }
  }

  const ack = async () => {
    try {
      await fetch(`/api/mobilidade/solicitar/${conclusao.solicitacao_id}/conclusao-ack`, {
        method: 'POST',
      })
    } catch {
      /* ignore */
    }
    setFase('avaliar')
  }

  const fechar = () => {
    setDismissedId(conclusao.solicitacao_id)
    setConclusao(null)
  }

  return (
    <PopupConclusaoAtendimentoMobilidade
      aberto
      papel="turista"
      fase={fase}
      solicitacaoId={conclusao.solicitacao_id}
      valorTexto={valorTexto}
      detalhes={detalhes}
      onAvancar={() => void ack()}
      onFechar={fechar}
    />
  )
}
