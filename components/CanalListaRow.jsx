'use client'

import CanalNaoLidasBadge from '@/components/CanalNaoLidasBadge'

/**
 * Linha de canal estilo lista WhatsApp.
 * @param {{
 *   label: import('react').ReactNode
 *   preview?: string | null
 *   hora?: string | null
 *   naoLidas?: number
 *   active?: boolean
 *   disabled?: boolean
 *   somenteTitulo?: boolean
 *   subtitulo?: string | null
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
  somenteTitulo = false,
  subtitulo = null,
  onClick,
  avatar,
}) {
  if (somenteTitulo) {
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
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="min-w-0 text-[15px] font-normal text-gray-800">{label}</div>
            {subtitulo ? <p className="mt-0.5 truncate text-xs text-gray-500">{subtitulo}</p> : null}
          </div>
          <CanalNaoLidasBadge count={naoLidas} />
        </div>
      </button>
    )
  }

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
          <div className="min-w-0 flex-1 text-[15px] font-normal text-gray-800">{label}</div>
          {hora ? (
            <span className="shrink-0 text-xs text-gray-500">
              {hora}
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-sm font-normal text-gray-500">
            {preview || ' '}
          </p>
          <CanalNaoLidasBadge count={naoLidas} />
        </div>
      </div>
    </button>
  )
}
