'use client'

import { Share2 } from 'lucide-react'

/**
 * @param {{ total: number, onClick: () => void }} props
 */
export default function BotaoCompartilhar({ total, onClick }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1 text-sm text-gray-600">
      <Share2 size={22} className="text-gray-500" aria-hidden />
      <span>{total}</span>
    </button>
  )
}
