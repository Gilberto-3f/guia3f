'use client'

import { ShieldCheck } from 'lucide-react'

/**
 * @param {{
 *   nome: string
 *   mostrarCartao?: boolean
 *   onAbrirCartao?: () => void
 * }} props
 */
export default function NomeSocial({ nome, mostrarCartao = false, onAbrirCartao }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {mostrarCartao ? (
        <button
          type="button"
          onClick={() => onAbrirCartao?.()}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0097b2] text-white"
          aria-label="Abrir cartão de visita"
          title="Cartão de visita"
        >
          <ShieldCheck size={18} className="text-white" aria-hidden />
        </button>
      ) : null}
      <h1 className="min-w-0 truncate text-left text-2xl font-bold text-[#001f3f]">{nome}</h1>
    </div>
  )
}
