'use client'

import { useState } from 'react'
import { CheckCircle2, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
import AvaliacaoCorridaMobilidade from '@/components/mobilidade/AvaliacaoCorridaMobilidade'

const VERDE = '#00D443'

export type FaseConclusaoUi = 'resumo' | 'aguardando' | 'avaliar'

type Props = {
  aberto: boolean
  papel: 'profissional' | 'turista'
  fase: FaseConclusaoUi
  solicitacaoId: string
  /** Valor principal formatado (ex.: R$ 45,00). */
  valorTexto: string | null
  /** Linhas extras (comissão, bônus, forma de pagamento). */
  detalhes?: string[]
  onAvancar: () => void
  onFechar: () => void
}

/**
 * Popup verde pós-conclusão:
 * 1) resumo + RECEBIDO (pro) / OK (turista)
 * 2) aguardando a outra parte (cadeia)
 * 3) avaliação (texto preto no card branco)
 */
export default function PopupConclusaoAtendimentoMobilidade({
  aberto,
  papel,
  fase,
  solicitacaoId,
  valorTexto,
  detalhes = [],
  onAvancar,
  onFechar,
}: Props) {
  useModalScrollLock(aberto)
  const t = useTranslations('Mobilidade')
  const [busyAck, setBusyAck] = useState(false)

  if (!aberto) return null

  const cta =
    fase === 'resumo'
      ? papel === 'profissional'
        ? t('conclusaoRecebido')
        : t('conclusaoOk')
      : null

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/50 p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={t('fechar')}
        onClick={onFechar}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="popup-conclusao-titulo"
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl shadow-2xl"
        style={{ backgroundColor: VERDE }}
      >
        <button
          type="button"
          onClick={onFechar}
          className="absolute right-3 top-3 text-white/90 hover:text-white"
          aria-label={t('fechar')}
        >
          <X className="h-5 w-5" strokeWidth={2} aria-hidden />
        </button>

        <div className="px-5 pb-6 pt-8 text-center text-white">
          <div className="mb-3 flex justify-center">
            <CheckCircle2 className="h-12 w-12" strokeWidth={1.75} aria-hidden />
          </div>
          <h2 id="popup-conclusao-titulo" className="text-xl font-bold uppercase tracking-wide">
            {t('conclusaoTitulo')}
          </h2>

          {fase === 'resumo' ? (
            <>
              {valorTexto ? (
                <p className="mt-3 text-2xl font-extrabold tabular-nums text-white">
                  {papel === 'turista' ? t('conclusaoValorPagar', { v: valorTexto }) : valorTexto}
                </p>
              ) : (
                <p className="mt-3 text-sm text-white/95">{t('corridaConcluida')}</p>
              )}
              {detalhes.length > 0 ? (
                <ul className="mt-2 space-y-0.5 text-xs text-white/90">
                  {detalhes.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              ) : null}

              <button
                type="button"
                disabled={busyAck}
                onClick={() => {
                  setBusyAck(true)
                  try {
                    onAvancar()
                  } finally {
                    setBusyAck(false)
                  }
                }}
                className="mt-5 w-full rounded-xl bg-white py-3 text-sm font-bold uppercase tracking-wide text-[#0097b2] disabled:opacity-50"
              >
                {cta}
              </button>
            </>
          ) : fase === 'aguardando' ? (
            <p className="mt-4 text-sm font-medium text-white">
              {papel === 'profissional'
                ? t('conclusaoAguardandoTurista')
                : t('conclusaoAguardandoPro')}
            </p>
          ) : (
            <div className="mt-4 rounded-2xl bg-white p-3 text-left text-gray-900 shadow-sm">
              <AvaliacaoCorridaMobilidade
                solicitacaoId={solicitacaoId}
                titulo={
                  papel === 'profissional'
                    ? t('avaliacaoTuristaTitulo')
                    : t('avaliacaoProfissionalTitulo')
                }
                onConcluido={onFechar}
              />
              <button
                type="button"
                onClick={onFechar}
                className="mt-2 w-full py-2 text-xs font-semibold text-gray-700 underline"
              >
                {t('conclusaoPularAvaliacao')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
