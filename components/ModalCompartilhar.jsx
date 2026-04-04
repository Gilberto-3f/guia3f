'use client'

import { X } from 'lucide-react'

/**
 * @param {{
 *   aberto: boolean
 *   onFechar: () => void
 *   postUrl: string
 *   tituloResumo: string
 * }} props
 */
export default function ModalCompartilhar({ aberto, onFechar, postUrl, tituloResumo }) {
  const compartilharWhatsApp = () => {
    const u = `https://wa.me/?text=${encodeURIComponent(`${tituloResumo} ${postUrl}`)}`
    window.open(u, '_blank')
    onFechar()
  }

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(postUrl)
    } catch {
      alert('Não foi possível copiar')
    }
  }

  if (!aberto) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white text-black shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h3 className="font-bold text-black">Compartilhar</h3>
          <button type="button" onClick={onFechar} className="text-black" aria-label="Fechar">
            <X size={22} />
          </button>
        </div>
        <div className="p-4">
          <button type="button" onClick={() => void copiarLink()} className="w-full p-3 text-left text-black">
            📋 Copiar link
          </button>
          <button type="button" onClick={compartilharWhatsApp} className="w-full p-3 text-left text-black">
            📱 Enviar no WhatsApp
          </button>
        </div>
      </div>
    </div>
  )
}
