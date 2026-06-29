'use client'

import ModoApresentacaoIcon from '@/components/ModoApresentacaoIcon'

/** Azul primário da logo. */
const COR_AZUL = '#0097b2'

/**
 * Aviso de reserva pendente conflitante em outra hospedagem (pré-cancelamento).
 * @param {{ isOpen: boolean, onOk: () => void }} props
 */
export default function PopupAvisoReservaHospedagemConflito({ isOpen, onOk }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Fechar aviso"
        onClick={onOk}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="aviso-reserva-conflito-titulo"
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl shadow-2xl"
        style={{ backgroundColor: COR_AZUL }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pb-6 pt-8 text-center text-white">
          <div className="mb-4 flex justify-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15">
              <ModoApresentacaoIcon iconeKey="anfitriao" className="h-8 w-8 text-white" />
            </span>
          </div>
          <h2 id="aviso-reserva-conflito-titulo" className="text-lg font-bold">
            Reserva pendente
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/95">
            Já existe um pedido de reserva em análise. Você pode solicitar reservas em outros
            locais, mas quando um anfitrião confirmar um dos pedidos, as demais reservas pendentes
            nos <strong>mesmos dias</strong> serão canceladas automaticamente.
          </p>
          <button
            type="button"
            onClick={onOk}
            className="mt-6 w-full rounded-xl bg-white py-2.5 text-sm font-bold shadow-sm transition hover:bg-white/95"
            style={{ color: COR_AZUL }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}
