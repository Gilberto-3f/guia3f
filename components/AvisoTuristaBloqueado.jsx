'use client'

import { AVISO_TURISTA_CAMINHO, AVISO_TURISTA_TITULO } from '@/lib/avisoTuristaTexto'

/** Aviso quando turista não tem cadastro liberado nem pré-liberação vigente. */
export default function AvisoTuristaBloqueado({ className = '', compact = false }) {
  if (compact) {
    return (
      <p className={`text-center text-xs leading-snug text-amber-950 ${className}`}>
        <strong>{AVISO_TURISTA_TITULO}</strong> {AVISO_TURISTA_CAMINHO}
      </p>
    )
  }
  return (
    <div className={`rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-center ${className}`}>
      <p className="text-sm font-semibold text-amber-950">{AVISO_TURISTA_TITULO}</p>
      <p className="mt-2 text-xs leading-relaxed text-amber-900/90">{AVISO_TURISTA_CAMINHO}</p>
    </div>
  )
}
