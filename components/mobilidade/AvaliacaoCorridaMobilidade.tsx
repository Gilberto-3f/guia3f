'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import EstrelasAvaliacao from '@/components/EstrelasAvaliacao'

type Props = {
  solicitacaoId: string
  titulo?: string
  onConcluido?: () => void
}

/** Avaliação mútua pós-corrida (estrelas + feedback opcional). */
export default function AvaliacaoCorridaMobilidade({
  solicitacaoId,
  titulo,
  onConcluido,
}: Props) {
  const t = useTranslations('Mobilidade')
  const [nota, setNota] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState(false)

  const enviar = async () => {
    if (nota < 1 || busy) {
      setErro(t('avaliacaoNotaObrigatoria'))
      return
    }
    setBusy(true)
    setErro('')
    try {
      const res = await fetch(`/api/mobilidade/solicitar/${solicitacaoId}/avaliar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nota, feedback: feedback.trim() || null }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        setErro(String(json.error ?? t('avaliacaoErro')))
        return
      }
      setOk(true)
      onConcluido?.()
    } finally {
      setBusy(false)
    }
  }

  if (ok) {
    return (
      <div className="rounded-xl border border-[#00D443]/40 bg-green-50 px-3 py-3 text-center">
        <p className="text-sm font-semibold text-[#00D443]">{t('avaliacaoObrigado')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white px-3 py-3">
      <p className="text-sm font-bold text-[#0097b2]">{titulo ?? t('avaliacaoTitulo')}</p>
      <p className="text-[11px] text-gray-400">{t('avaliacaoAntiDisc')}</p>
      <div className="flex justify-center">
        <EstrelasAvaliacao nota={nota} onChange={setNota} tamanho={28} disabled={busy} />
      </div>
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        rows={2}
        maxLength={500}
        placeholder={t('avaliacaoPlaceholder')}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
      />
      {erro ? <p className="text-xs text-rose-600">{erro}</p> : null}
      <button
        type="button"
        disabled={busy || nota < 1}
        onClick={() => void enviar()}
        className="w-full rounded-xl bg-[#00D443] py-2.5 text-sm font-bold text-white disabled:opacity-50"
      >
        {t('avaliacaoEnviar')}
      </button>
    </div>
  )
}
