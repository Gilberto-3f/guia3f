'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import PopupConclusaoAtendimentoMobilidade, {
  type FaseConclusaoUi,
} from '@/components/mobilidade/PopupConclusaoAtendimentoMobilidade'
import { MOBILIDADE_CORRIDA_ATIVA, avisarLimparPesquisaMobilidade } from '@/lib/mobilidadeAtendimentoAtivoEventos'
import {
  MOBILIDADE_POLL_CONCLUSAO_ATIVA_MS,
  MOBILIDADE_POLL_CONCLUSAO_IDLE_MS,
} from '@/lib/mobilidadePoll'

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

let lastConclusaoFetchAt = 0
const MIN_GAP_CONCLUSAO_MS = 5_000

/**
 * Popup verde de conclusão + cadeia de avaliação (RECEBIDO → turista → profissional).
 */
export default function ConclusaoAtendimentoMobilidadeListener() {
  const t = useTranslations('Mobilidade')
  const { perfilEhProfissional, perfilEhTurista, perfilEhEmpresa, roleEfetivo, loading } =
    useProfissionalGate()
  const [conclusao, setConclusao] = useState<ConclusaoPendente | null>(null)
  const [fase, setFase] = useState<FaseConclusaoUi>('resumo')
  const [dismissedId, setDismissedId] = useState<string | null>(null)
  const falhasRef = useRef(0)

  const elegivel =
    !loading &&
    (perfilEhTurista ||
      perfilEhEmpresa ||
      roleEfetivo === 'admin' ||
      perfilEhProfissional)

  const carregar = useCallback(async () => {
    if (!elegivel) return
    const agora = Date.now()
    if (agora - lastConclusaoFetchAt < MIN_GAP_CONCLUSAO_MS) return
    lastConclusaoFetchAt = agora
    try {
      const res = await fetch('/api/mobilidade/conclusao-pendente')
      if (!res.ok) {
        falhasRef.current = Math.min(4, falhasRef.current + 1)
        return
      }
      falhasRef.current = 0
      const json = (await res.json()) as { conclusao?: ConclusaoPendente | null }
      const next = json.conclusao ?? null
      if (!next) {
        setConclusao(null)
        return
      }
      if (next.ja_avaliou) {
        setConclusao(null)
        return
      }
      if (dismissedId === next.solicitacao_id && next.fase !== 'avaliar') return
      setConclusao(next)
      setFase(next.fase === 'avaliar' || next.fase === 'aguardando' ? next.fase : 'resumo')
    } catch {
      falhasRef.current = Math.min(4, falhasRef.current + 1)
    }
  }, [elegivel, dismissedId])

  useEffect(() => {
    if (!elegivel) return
    const backoff = falhasRef.current > 0 ? MOBILIDADE_POLL_CONCLUSAO_IDLE_MS * (falhasRef.current + 1) : 0
    const intervalo =
      backoff || (conclusao ? MOBILIDADE_POLL_CONCLUSAO_ATIVA_MS : MOBILIDADE_POLL_CONCLUSAO_IDLE_MS)
    void carregar()
    const id = window.setInterval(() => void carregar(), intervalo)
    const onRefresh = () => void carregar()
    window.addEventListener(MOBILIDADE_CORRIDA_ATIVA, onRefresh)
    return () => {
      window.clearInterval(id)
      window.removeEventListener(MOBILIDADE_CORRIDA_ATIVA, onRefresh)
    }
  }, [elegivel, carregar, conclusao?.solicitacao_id])

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
  if (
    conclusao.papel === 'profissional' &&
    conclusao.valor_regular != null &&
    Number.isFinite(conclusao.valor_regular) &&
    conclusao.valor_regular > 0 &&
    conclusao.valor_regular !== conclusao.valor_corrida
  ) {
    detalhes.push(t('finSuaComissao', { v: formatBrl(conclusao.valor_regular) }))
  }
  if (conclusao.bonus_voluntario != null && conclusao.bonus_voluntario > 0) {
    detalhes.push(t('finBonus', { v: formatBrl(conclusao.bonus_voluntario) }))
  }

  const ack = async () => {
    try {
      await fetch(`/api/mobilidade/solicitar/${conclusao.solicitacao_id}/conclusao-ack`, {
        method: 'POST',
      })
    } catch {
      /* ignore */
    }
    void carregar()
  }

  const fechar = () => {
    setDismissedId(conclusao.solicitacao_id)
    setConclusao(null)
    avisarLimparPesquisaMobilidade()
  }

  return (
    <PopupConclusaoAtendimentoMobilidade
      aberto
      papel={conclusao.papel}
      fase={fase}
      solicitacaoId={conclusao.solicitacao_id}
      valorTexto={valorTexto}
      detalhes={detalhes}
      onAvancar={() => void ack()}
      onFechar={fechar}
    />
  )
}
