'use client'

import { Repeat2 } from 'lucide-react'

/**
 * @param {{ total: number, onClick: () => void, disabled?: boolean }} props
 */
export default function BotaoRepostar({ total, onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1 text-sm text-gray-600 disabled:opacity-50"
    >
      <Repeat2 size={22} className="text-gray-500" aria-hidden />
      <span>{total}</span>
    </button>
  )
}
