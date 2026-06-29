'use client'

import { X, CheckCircle2 } from 'lucide-react'
import ModoApresentacaoIcon from '@/components/ModoApresentacaoIcon'

/** Verde do botão dinâmico. */
const COR_VERDE = '#00D443'

const ICONES_PRO = ['guia', 'taxista', 'van', 'motorista_app', 'anfitriao', 'hospedagem']

/**
 * @param {{
 *   isOpen: boolean
 *   onClose: () => void
 *   empresaNome?: string
 *   dataCheckin?: string
 *   dataCheckout?: string
 *   onVerEmpresa?: () => void
 * }} props
 */
export default function PopupReservaConfirmadaTurista({
  isOpen,
  onClose,
  empresaNome = '',
  dataCheckin = '',
  dataCheckout = '',
  onVerEmpresa,
}) {
  if (!isOpen) return null

  const handleFechar = () => {
    onClose()
  }

  const handleVer = () => {
    onVerEmpresa?.()
    handleFechar()
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Fechar aviso"
        onClick={handleFechar}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="popup-reserva-confirmada-titulo"
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl shadow-2xl"
        style={{ backgroundColor: COR_VERDE }}
      >
        <button
          type="button"
          onClick={handleFechar}
          className="absolute right-3 top-3 text-white/90 hover:text-white"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" strokeWidth={2} aria-hidden />
        </button>

        <div className="px-5 pb-6 pt-8 text-center text-white">
          <div className="mb-3 flex justify-center">
            <CheckCircle2 className="h-12 w-12" strokeWidth={1.75} aria-hidden />
          </div>
          <h2 id="popup-reserva-confirmada-titulo" className="text-lg font-bold">
            Reserva confirmada!
          </h2>
          <p className="mt-2 text-sm font-semibold">{empresaNome || 'Sua reserva foi confirmada'}</p>
          <p className="mt-3 text-sm leading-relaxed text-white/95">
            O anfitrião confirmou sua reserva. O endereço já está liberado na aba{' '}
            <span className="font-semibold">Endereço</span> da página da empresa.
          </p>

          <div className="mt-4 flex flex-wrap justify-center gap-2.5" aria-hidden>
            {ICONES_PRO.map((key) => (
              <span
                key={key}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15"
              >
                <ModoApresentacaoIcon iconeKey={key} className="h-5 w-5 text-white" />
              </span>
            ))}
          </div>

          {(dataCheckin || dataCheckout) && (
            <p className="mt-3 text-xs text-white/90">
              {dataCheckin ? `Check-in ${dataCheckin}` : null}
              {dataCheckin && dataCheckout ? ' · ' : null}
              {dataCheckout ? `Check-out ${dataCheckout}` : null}
            </p>
          )}

          <button
            type="button"
            onClick={handleVer}
            className="mt-5 w-full rounded-xl bg-white py-2.5 text-sm font-bold text-[#00D443] shadow-sm transition hover:bg-white/95"
          >
            Ver hospedagem
          </button>
        </div>
      </div>
    </div>
  )
}
