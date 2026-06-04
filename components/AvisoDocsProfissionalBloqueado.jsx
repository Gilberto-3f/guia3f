'use client'

import { FileWarning } from 'lucide-react'
import { AVISO_DOCS_PROF_CAMINHO, AVISO_DOCS_PROF_TITULO } from '@/lib/avisoDocsProfissionalTexto'

/** Aviso padrão: recursos de profissional bloqueados até verificação ADM dos documentos. */
export default function AvisoDocsProfissionalBloqueado({ className = '', compact = false }) {
  return (
    <div
      className={`flex flex-1 flex-col items-center justify-start px-4 text-center text-gray-600 ${
        compact ? 'py-6' : 'py-10'
      } ${className}`.trim()}
    >
      <FileWarning className="mb-3 h-10 w-10 text-amber-500" aria-hidden />
      <p className="max-w-md text-sm leading-relaxed">{AVISO_DOCS_PROF_TITULO}</p>
      <p className="mt-2 max-w-md text-xs text-gray-500">{AVISO_DOCS_PROF_CAMINHO}</p>
    </div>
  )
}
