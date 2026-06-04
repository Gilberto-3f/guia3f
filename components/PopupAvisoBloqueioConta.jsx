'use client'

import { X } from 'lucide-react'
import { useModalScrollLock } from '@/lib/useModalScrollLock'

/**
 * @param {{ aberto: boolean, onFechar: () => void, titulo?: string, mensagem: string }} props
 */
export default function PopupAvisoBloqueioConta({
  aberto,
  onFechar,
  titulo = 'Serviço indisponível',
  mensagem,
}) {
  useModalScrollLock(aberto)

  if (!aberto || !mensagem) return null

  return (
    <div
      className="fixed inset-0 z-[260] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={onFechar}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="aviso-bloqueio-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="aviso-bloqueio-titulo" className="text-lg font-bold text-[#001f3f]">
            {titulo}
          </h2>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Fechar"
          >
            <X size={22} aria-hidden />
          </button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-gray-700">{mensagem}</p>
        <button
          type="button"
          onClick={onFechar}
          className="mt-5 w-full rounded-xl bg-[#0097b2] py-3 text-sm font-bold text-white hover:opacity-95"
        >
          Entendi
        </button>
      </div>
    </div>
  )
}
