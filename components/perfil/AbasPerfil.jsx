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
      <div className="flex justify-evenly border-b border-[#E0E0E0] bg-white px-1">
        {tabs.map((item) => {
          const Icon = item.icon
          const selecionada = ativa === item.key
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              aria-label={item.label}
              className="flex shrink-0 flex-col items-center px-1.5 pt-2.5"
            >
              <span
                className={`inline-flex items-center gap-1.5 border-b-[3px] pb-2 text-[17px] font-bold leading-none transition-colors ${
                  selecionada
                    ? 'border-[#0097b2] text-[#0097b2]'
                    : 'border-transparent text-gray-500'
                }`}
              >
                <Icon size={22} strokeWidth={2.25} aria-hidden />
                <span>{selecionada ? item.label : item.count}</span>
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex justify-evenly border-b border-[#E0E0E0] bg-white px-1">
      {tabs.map((item) => {
        const Icon = item.icon
        const selecionada = ativa === item.key
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className="flex shrink-0 flex-col items-center px-1.5 pt-2"
          >
            <span
              className={`inline-flex flex-col items-center gap-0.5 border-b-[3px] pb-1.5 text-sm font-bold transition-colors ${
                selecionada
                  ? 'border-[#0097b2] text-[#0097b2]'
                  : 'border-transparent text-gray-500'
              }`}
            >
              <Icon size={22} strokeWidth={2.25} aria-hidden />
              <span>{item.label.toUpperCase()}</span>
              <span className="text-xs opacity-80">({item.count})</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
