'use client'

import { X, CheckCircle2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
import { openWhatsAppChat } from '@/lib/whatsapp-empresa'

const VERDE = '#00D443'

type Props = {
  aberto: boolean
  usernameProfissional?: string | null
  whatsappProfissional?: string | null
  onFechar: () => void
}

/** Popup verde: Profissional CHEGOU!!! — WhatsApp do profissional. */
export default function PopupChegadaTuristaMobilidade({
  aberto,
  usernameProfissional = null,
  whatsappProfissional = null,
  onFechar,
}: Props) {
  useModalScrollLock(aberto)
  const t = useTranslations('Mobilidade')

  if (!aberto) return null

  const handle = String(usernameProfissional ?? '')
    .replace(/^@+/, '')
    .trim()
  const handleLabel = handle ? `@${handle}` : t('atendimentoTuristaFallback')

  const abrirWhats = () => {
    const msg = t('chegadaWhatsappMsg', { user: handleLabel })
    if (!openWhatsAppChat(whatsappProfissional, msg)) {
      /* telefone ausente — popup permanece */
    }
  }

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
        aria-labelledby="popup-pro-chegou-titulo"
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
          <h2 id="popup-pro-chegou-titulo" className="text-xl font-bold uppercase tracking-wide">
            {t('chegadaProTitulo')}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/95">
            {t('chegadaProTexto', { user: handleLabel })}
          </p>

          <div className="mt-5 rounded-2xl bg-white p-3 shadow-sm">
            <button
              type="button"
              onClick={abrirWhats}
              disabled={!whatsappProfissional}
              className="w-full rounded-xl bg-[#25D366] py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {t('chegadaWhatsapp')}
            </button>
            {!whatsappProfissional ? (
              <p className="mt-2 text-[11px] text-gray-500">{t('chegadaWhatsappIndisponivel')}</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
