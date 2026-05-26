'use client'

import CanalNaoLidasBadge from '@/components/CanalNaoLidasBadge'

/**
 * Linha de canal estilo lista WhatsApp.
 * @param {{
 *   label: string
 *   preview?: string | null
 *   hora?: string | null
 *   naoLidas?: number
 *   active?: boolean
 *   disabled?: boolean
 *   onClick: () => void
 *   avatar: import('react').ReactNode
 * }} props
 */
export default function CanalListaRow({
  label,
  preview = null,
  hora = null,
  naoLidas = 0,
  active = false,
  disabled = false,
  onClick,
  avatar,
}) {
  const naoLido = naoLidas > 0

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 border-b border-gray-200/80 px-4 py-3 text-left transition-colors ${
        disabled ? 'cursor-not-allowed opacity-60' : active ? 'bg-[#0097b2]/8' : 'hover:bg-gray-50'
      }`}
    >
      <div className="shrink-0">{avatar}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <h3
            className={`min-w-0 truncate text-[15px] ${
              naoLido ? 'font-bold text-gray-900' : 'font-medium text-gray-800'
            }`}
          >
            {label}
          </h3>
          {hora ? (
            <span
              className={`shrink-0 text-xs ${naoLido ? 'font-semibold text-[#0097b2]' : 'text-gray-500'}`}
            >
              {hora}
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p
            className={`min-w-0 truncate text-sm ${
              naoLido ? 'font-medium text-gray-700' : 'text-gray-500'
            }`}
          >
            {preview || ' '}
          </p>
          <CanalNaoLidasBadge count={naoLidas} />
        </div>
      </div>
    </button>
  )
}
