'use client'

import { Camera, FileText, Repeat2 } from 'lucide-react'

/**
 * @param {{
 *   ativa: 'fotos' | 'posts' | 'republicados'
 *   onChange: (t: 'fotos' | 'posts' | 'republicados') => void
 *   counts: { fotos: number; posts: number; republicados: number }
 * }} props
 */
export default function AbasPerfil({ ativa, onChange, counts }) {
  const tab = (key, label, icon, n) => (
    <button
      type="button"
      onClick={() => onChange(key)}
      className={`flex flex-1 flex-col items-center gap-0.5 border-b-2 py-2 text-xs font-medium transition-colors ${
        ativa === key ? 'border-[#0097b2] text-[#0097b2]' : 'border-transparent text-gray-500'
      }`}
    >
      {icon}
      <span>{label}</span>
      <span className="text-[10px] opacity-80">({n})</span>
    </button>
  )

  return (
    <div className="flex border-b border-[#E0E0E0] bg-white px-2">
      {tab('fotos', 'FOTOS', <Camera size={18} aria-hidden />, counts.fotos)}
      {tab('posts', 'POSTS', <FileText size={18} aria-hidden />, counts.posts)}
      {tab('republicados', 'REPOSTADOS', <Repeat2 size={18} aria-hidden />, counts.republicados)}
    </div>
  )
}
