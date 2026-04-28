'use client'

import { useEffect, useState } from 'react'

/**
 * @param {{ mensagem?: string; iniciadoEm?: number | null; detalhe?: string }} props
 */
export default function LoadingOverlay({ mensagem = 'Publicando…', iniciadoEm = null, detalhe = 'Aguarde, não feche esta tela.' }) {
  const [agora, setAgora] = useState(() => Date.now())

  useEffect(() => {
    const t = window.setInterval(() => setAgora(Date.now()), 250)
    return () => window.clearInterval(t)
  }, [])

  const segundos =
    iniciadoEm && iniciadoEm > 0 ? Math.max(0, Math.floor((agora - iniciadoEm) / 1000)) : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Publicando"
    >
      <div className="mx-6 w-full max-w-xs rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex flex-col items-center gap-3 text-center">
          <div
            className="h-12 w-12 animate-spin rounded-full border-4 border-[#0097b2] border-t-transparent"
            aria-hidden
          />
          <p className="text-base font-semibold text-gray-800">{mensagem}</p>
          <p className="text-sm text-gray-500">{detalhe}</p>
          {segundos != null ? <p className="text-xs font-semibold text-gray-400">{segundos}s</p> : null}
        </div>
      </div>
    </div>
  )
}

