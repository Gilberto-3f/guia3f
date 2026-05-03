'use client'

import { Star } from 'lucide-react'

/**
 * @param {{ nota: number, onChange: (n: number) => void, tamanho?: number, disabled?: boolean }} props
 */
export default function EstrelasAvaliacao({ nota, onChange, tamanho = 32, disabled = false }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((valor) => (
        <button
          key={valor}
          type="button"
          disabled={disabled}
          onClick={() => {
            if (!disabled) onChange(valor)
          }}
          className="focus:outline-none disabled:cursor-not-allowed"
        >
          <Star
            size={tamanho}
            className={`transition-colors ${
              valor <= nota ? 'fill-[#FFD700] text-[#FFD700]' : 'text-gray-300'
            }`}
            aria-hidden
          />
        </button>
      ))}
    </div>
  )
}
