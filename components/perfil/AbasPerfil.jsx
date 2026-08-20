'use client'

import { Camera, FileText, Repeat2 } from 'lucide-react'

/**
 * @param {{
 *   ativa: 'fotos' | 'posts' | 'republicados'
 *   onChange: (t: 'fotos' | 'posts' | 'republicados') => void
 *   counts: { fotos: number; posts: number; republicados: number }
 *   modoCompacto?: boolean
 * }} props
 */
export default function AbasPerfil({ ativa, onChange, counts, modoCompacto = false }) {
  const tabs = [
    { key: 'fotos', label: 'Fotos', icon: Camera, count: counts.fotos },
    { key: 'posts', label: 'Postagens', icon: FileText, count: counts.posts },
    { key: 'republicados', label: 'Repostados', icon: Repeat2, count: counts.republicados },
  ]

  if (modoCompacto) {
    return (
      <div className="flex w-full border-b border-[#E0E0E0] bg-white">
        {tabs.map((item, idx) => {
          const Icon = item.icon
          const selecionada = ativa === item.key
          const lado =
            idx === 0
              ? 'justify-start pl-3'
              : idx === tabs.length - 1
                ? 'justify-end pr-3'
                : 'justify-center'
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              aria-label={item.label}
              className={`flex min-w-0 flex-1 items-center gap-1.5 border-b-[3px] py-2.5 text-[17px] font-bold leading-none transition-colors ${lado} ${
                selecionada
                  ? 'border-[#0097b2] text-[#0097b2]'
                  : 'border-transparent text-gray-500'
              }`}
            >
              <Icon size={22} strokeWidth={2.25} className="shrink-0" aria-hidden />
              <span>{selecionada ? item.label : item.count}</span>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex w-full border-b border-[#E0E0E0] bg-white">
      {tabs.map((item, idx) => {
        const Icon = item.icon
        const selecionada = ativa === item.key
        const lado =
          idx === 0
            ? 'items-start pl-3'
            : idx === tabs.length - 1
              ? 'items-end pr-3'
              : 'items-center'
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={`flex min-w-0 flex-1 flex-col border-b-[3px] pt-2 pb-1.5 text-sm font-bold transition-colors ${lado} ${
              selecionada
                ? 'border-[#0097b2] text-[#0097b2]'
                : 'border-transparent text-gray-500'
            }`}
          >
            <Icon size={22} strokeWidth={2.25} className="shrink-0" aria-hidden />
            <span>{item.label.toUpperCase()}</span>
            <span className="text-xs opacity-80">({item.count})</span>
          </button>
        )
      })}
    </div>
  )
}
