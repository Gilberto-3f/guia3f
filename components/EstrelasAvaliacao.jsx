'use client'

import { Star } from 'lucide-react'

/**
 * @param {{ nota: number, onChange: (n: number) => void, tamanho?: number }} props
 */
export default function EstrelasAvaliacao({ nota, onChange, tamanho = 32 }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((valor) => (
        <button key={valor} type="button" onClick={() => onChange(valor)} className="focus:outline-none">
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
