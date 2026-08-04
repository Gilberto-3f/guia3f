'use client'

import { X, CheckCircle2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useModalScrollLock } from '@/lib/useModalScrollLock'

const VERDE = '#00D443'

type Props = {
  aberto: boolean
  busy?: boolean
  erro?: string
  onSim: () => void
  onNao: () => void
  onFechar?: () => void
}

/** Popup verde: VOCÊ CHEGOU!!! — confirma se o turista foi recebido. */
export default function PopupChegadaProfissionalMobilidade({
  aberto,
  busy = false,
  erro = '',
  onSim,
  onNao,
  onFechar,
}: Props) {
  useModalScrollLock(aberto)
  const t = useTranslations('Mobilidade')

  if (!aberto) return null

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/50 p-4">
      {onFechar ? (
        <button
          type="button"
          className="absolute inset-0 cursor-default"
          aria-label={t('fechar')}
          disabled={busy}
          onClick={onFechar}
        />
      ) : null}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="popup-voce-chegou-titulo"
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl shadow-2xl"
        style={{ backgroundColor: VERDE }}
      >
        {onFechar ? (
          <button
            type="button"
            disabled={busy}
            onClick={onFechar}
            className="absolute right-3 top-3 text-white/90 hover:text-white disabled:opacity-50"
            aria-label={t('fechar')}
          >
            <X className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
        ) : null}

        <div className="px-5 pb-6 pt-8 text-center text-white">
          <div className="mb-3 flex justify-center">
            <CheckCircle2 className="h-12 w-12" strokeWidth={1.75} aria-hidden />
          </div>
          <h2 id="popup-voce-chegou-titulo" className="text-xl font-bold uppercase tracking-wide">
            {t('chegadaVoceTitulo')}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/95">{t('chegadaVoceTexto')}</p>

          <div className="mt-5 rounded-2xl bg-white p-3 shadow-sm">
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={onNao}
                className="flex-1 rounded-xl bg-rose-600 py-3 text-sm font-bold uppercase text-white disabled:opacity-50"
              >
                {t('chegadaNao')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onSim}
                className="flex-1 rounded-xl bg-[#00D443] py-3 text-sm font-bold uppercase text-white disabled:opacity-50"
              >
                {t('chegadaSim')}
              </button>
            </div>
          </div>

          {erro ? <p className="mt-3 text-xs font-medium text-white">{erro}</p> : null}
        </div>
      </div>
    </div>
  )
}
