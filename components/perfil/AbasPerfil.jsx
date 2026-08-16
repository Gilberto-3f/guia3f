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
      <div className="flex border-b border-[#E0E0E0] bg-white px-2">
        {tabs.map((item) => {
          const Icon = item.icon
          const selecionada = ativa === item.key
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              aria-label={item.label}
              className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2.5 text-sm font-medium transition-colors ${
                selecionada
                  ? 'border-[#0097b2] text-[#0097b2]'
                  : 'border-transparent text-gray-500'
              }`}
            >
              <Icon size={18} aria-hidden />
              <span>{selecionada ? item.label : item.count}</span>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex border-b border-[#E0E0E0] bg-white px-2">
      {tabs.map((item) => {
        const Icon = item.icon
        const selecionada = ativa === item.key
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={`flex flex-1 flex-col items-center gap-0.5 border-b-2 py-2 text-xs font-medium transition-colors ${
              selecionada
                ? 'border-[#0097b2] text-[#0097b2]'
                : 'border-transparent text-gray-500'
            }`}
          >
            <Icon size={18} aria-hidden />
            <span>{item.label.toUpperCase()}</span>
            <span className="text-[10px] opacity-80">({item.count})</span>
          </button>
        )
      })}
    </div>
  )
}
