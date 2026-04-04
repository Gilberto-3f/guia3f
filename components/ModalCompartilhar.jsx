'use client'

import { useState } from 'react'
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
  const [copiado, setCopiado] = useState(false)

  const whatsapp = () => {
    const u = `https://wa.me/?text=${encodeURIComponent(`${tituloResumo} ${postUrl}`)}`
    window.open(u, '_blank')
    onFechar()
  }

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(postUrl)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      alert('Não foi possível copiar')
    }
  }

  if (!aberto) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-4 text-gray-900 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Compartilhar</h3>
          <button type="button" onClick={onFechar} className="text-gray-900" aria-label="Fechar">
            <X size={22} />
          </button>
        </div>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => void copiar()}
            className="w-full rounded-lg border border-gray-200 bg-white py-3 text-sm font-medium text-gray-900"
          >
            {copiado ? 'Copiado!' : 'Copiar link'}
          </button>
          <button
            type="button"
            onClick={whatsapp}
            className="w-full rounded-lg border border-gray-200 bg-white py-3 text-sm font-medium text-gray-900"
          >
            Enviar no WhatsApp
          </button>
        </div>
      </div>
    </div>
  )
}
