'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useModalScrollLock } from '@/lib/useModalScrollLock'
import { FINALIZACAO_OUTRO_MAX } from '@/lib/manifestoFinalizacaoSemCheckin'

const COR = '#0097b2'
const VERDE = '#00D443'

type Props = {
  aberto: boolean
  motivoProfissional: string
  busy?: boolean
  erro?: string | null
  onConfirmar: () => void
  onOutro: (texto: string) => void
}

/** Turista confirma (ou registra OUTRO) a finalização sem check-in. */
export default function PopupFinalizacaoSemCheckinTurista({
  aberto,
  motivoProfissional,
  busy = false,
  erro = null,
  onConfirmar,
  onOutro,
}: Props) {
  useModalScrollLock(aberto)
  const t = useTranslations('Mobilidade')
  const [modoOutro, setModoOutro] = useState(false)
  const [texto, setTexto] = useState('')

  useEffect(() => {
    if (!aberto) {
      setModoOutro(false)
      setTexto('')
    }
  }, [aberto])

  if (!aberto) return null

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="popup-fin-sem-checkin-titulo"
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="px-5 pb-5 pt-6 text-center">
          <h2
            id="popup-fin-sem-checkin-titulo"
            className="text-base font-bold leading-snug text-gray-900"
          >
            {t('finalizarSemCheckinTuristaPergunta')}
          </h2>
          <div
            className="mt-4 rounded-xl px-3 py-3 text-left text-sm text-white"
            style={{ backgroundColor: COR }}
          >
            <p className="text-[11px] font-bold uppercase tracking-wide text-white/80">
              {t('finalizarSemCheckinMotivoTitulo')}
            </p>
            <p className="mt-1 font-semibold leading-snug">{motivoProfissional || '—'}</p>
          </div>

          {modoOutro ? (
            <label className="mt-4 block text-left text-xs text-gray-600">
              {t('finalizarSemCheckinOutroLabel')}
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value.slice(0, FINALIZACAO_OUTRO_MAX))}
                rows={3}
                maxLength={FINALIZACAO_OUTRO_MAX}
                placeholder={t('finalizarSemCheckinOutroPlaceholder')}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#0097b2]/40"
              />
            </label>
          ) : null}

          {erro ? <p className="mt-3 text-xs font-medium text-rose-600">{erro}</p> : null}

          {modoOutro ? (
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setModoOutro(false)
                  setTexto('')
                }}
                className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-600 disabled:opacity-50"
              >
                {t('voltar')}
              </button>
              <button
                type="button"
                disabled={busy || !texto.trim()}
                onClick={() => onOutro(texto.trim())}
                className="flex-1 rounded-xl py-3 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-50"
                style={{ backgroundColor: COR }}
              >
                {t('finalizarSemCheckinConfirmar')}
              </button>
            </div>
          ) : (
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={onConfirmar}
                className="flex-1 rounded-xl py-3 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-50"
                style={{ backgroundColor: VERDE }}
              >
                {t('finalizarSemCheckinConfirmo')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setModoOutro(true)}
                className="flex-1 rounded-xl py-3 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-50"
                style={{ backgroundColor: COR }}
              >
                {t('finalizarSemCheckinOutro')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
