'use client'

import { X, CheckCircle2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { createPortal } from 'react-dom'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
import { propsUmToque } from '@/lib/umToque'

const VERDE = '#00D443'

type Props = {
  aberto: boolean
  usernameProfissional?: string | null
  onFechar: () => void
  /** Após OK — tipicamente reabre o drawer de atendimento. */
  onOk?: () => void
}

/** Popup verde curto: Profissional CHEGOU!!! (sem WhatsApp). */
export default function PopupChegadaTuristaMobilidade({
  aberto,
  usernameProfissional = null,
  onFechar,
  onOk,
}: Props) {
  useModalScrollLock(aberto)
  const t = useTranslations('Mobilidade')

  const handle = String(usernameProfissional ?? '')
    .replace(/^@+/, '')
    .trim()
  const handleLabel = handle ? `@${handle}` : t('atendimentoProfissionalFallback')

  const confirmar = () => {
    onFechar()
    onOk?.()
  }

  if (typeof document === 'undefined' || !aberto) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/50 p-4 touch-manipulation"
      onClick={confirmar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="popup-pro-chegou-titulo"
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl shadow-2xl"
        style={{ backgroundColor: VERDE }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          {...propsUmToque(confirmar)}
          className="absolute right-3 top-3 cursor-pointer text-white/90 hover:text-white"
          aria-label={t('fechar')}
        >
          <X className="h-5 w-5" strokeWidth={2} aria-hidden />
        </button>

        <div className="px-5 pb-6 pt-8 text-center text-white">
          <div className="mb-3 flex justify-center">
            <CheckCircle2 className="h-12 w-12" strokeWidth={1.75} aria-hidden />
          </div>
          <h2 id="popup-pro-chegou-titulo" className="text-xl font-bold uppercase tracking-wide">
            {t('chegadaProTitulo')}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/95">
            {t('chegadaProTexto', { user: handleLabel })}
          </p>

          <button
            type="button"
            {...propsUmToque(confirmar)}
            className="mt-5 w-full cursor-pointer touch-manipulation rounded-xl bg-white py-3 text-sm font-bold uppercase tracking-wide text-[#0097b2]"
          >
            {t('chegadaProOk')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
