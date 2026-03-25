'use client'

import { Star, MapPin } from 'lucide-react'

/**
 * @param {{
 *   ordenacao: 'avaliacoes' | 'proximidade',
 *   onOrdenacaoChange: (ordenacao: 'avaliacoes' | 'proximidade') => void
 * }} props
 */
export default function Ordenacao({ ordenacao, onOrdenacaoChange }) {
  return (
    <div className="flex gap-2 p-4 pb-0">
      <button
        type="button"
        onClick={() => onOrdenacaoChange('avaliacoes')}
        className={`rounded-full p-2 transition-colors ${
          ordenacao === 'avaliacoes'
            ? 'bg-[#0097b2] text-white'
            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
        }`}
        title="Ordenar por avaliações"
      >
        <Star size={20} />
      </button>
      <button
        type="button"
        onClick={() => onOrdenacaoChange('proximidade')}
        className={`rounded-full p-2 transition-colors ${
          ordenacao === 'proximidade'
            ? 'bg-[#0097b2] text-white'
            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
        }`}
        title="Ordenar por proximidade"
      >
        <MapPin size={20} />
      </button>
    </div>
  )
}
