'use client'

import { MessageCircle } from 'lucide-react'

/**
 * @param {{ total: number, onClick: () => void }} props
 */
export default function BotaoComentar({ total, onClick }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1 text-sm text-gray-600">
      <MessageCircle size={22} className="text-gray-500" aria-hidden />
      <span>{total}</span>
    </button>
  )
}
