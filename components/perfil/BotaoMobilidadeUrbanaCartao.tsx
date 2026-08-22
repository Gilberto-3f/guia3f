'use client'

import { User } from 'lucide-react'

type Props = {
  className?: string
  /** Reservado: API do parceiro ou download do app. Sem ação por enquanto. */
  onClick?: () => void
}

/**
 * Cartão de visita do motorista de app — atalho de mobilidade urbana.
 * Visual: verde (#00D443) com margem branca, texto e ícone em branco.
 */
export default function BotaoMobilidadeUrbanaCartao({ className = '', onClick }: Props) {
  return (
    <div className={`rounded-[0.9rem] bg-white p-0.5 ${className}`.trim()}>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-base font-bold text-white"
        style={{ backgroundColor: '#00D443' }}
        aria-label="Mobilidade urbana"
      >
        <User size={20} className="shrink-0 text-white" strokeWidth={2.25} aria-hidden />
        MOBILIDADE URBANA
      </button>
    </div>
  )
}
