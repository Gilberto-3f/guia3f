'use client'

import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
import { propsUmToque } from '@/lib/umToque'

const COR = '#0097b2'
const VERDE = '#00D443'
const VERMELHO = '#E53935'

type Props = {
  aberto: boolean
  busy?: boolean
  erro?: string | null
  onConfirmar: () => void
  onRecusar: () => void
}

/** Turista confirma ou recusa a finalização antecipada (sem check-in). */
export default function PopupFinalizacaoSemCheckinTurista({
  aberto,
  busy = false,
  erro = null,
  onConfirmar,
  onRecusar,
}: Props) {
  useModalScrollLock(aberto)
  const t = useTranslations('Mobilidade')

  if (typeof document === 'undefined' || !aberto) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/50 p-4 touch-manipulation"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="popup-fin-sem-checkin-titulo"
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pb-5 pt-6 text-center">
          <h2
            id="popup-fin-sem-checkin-titulo"
            className="text-lg font-bold leading-snug"
            style={{ color: COR }}
          >
            {t('finalizarSemCheckinTuristaTitulo')}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-800">
            {t('finalizarSemCheckinTuristaPergunta')}
          </p>

          {erro ? <p className="mt-3 text-xs font-medium text-rose-600">{erro}</p> : null}

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              disabled={busy}
              {...propsUmToque(onConfirmar, busy)}
              className="flex-1 cursor-pointer touch-manipulation rounded-xl py-3 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-50"
              style={{ backgroundColor: VERDE }}
            >
              {t('chegadaSim')}
            </button>
            <button
              type="button"
              disabled={busy}
              {...propsUmToque(onRecusar, busy)}
              className="flex-1 cursor-pointer touch-manipulation rounded-xl py-3 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-50"
              style={{ backgroundColor: VERMELHO }}
            >
              {t('chegadaNao')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
