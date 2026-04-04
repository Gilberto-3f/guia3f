'use client'

import { Heart, MessageCircle } from 'lucide-react'

/**
 * @param {{
 *   posts: { id: string; texto: string | null; created_at: string; total_curtidas: number; total_comentarios: number }[]
 * }} props
 */
export default function AbaPosts({ posts }) {
  if (posts.length === 0) {
    return <p className="py-12 text-center text-sm text-gray-400">Nenhum post de texto</p>
  }

  return (
    <ul className="space-y-3 px-3">
      {posts.map((p) => (
        <li key={p.id} className="rounded-lg border border-[#E0E0E0] bg-white p-3 shadow-sm">
          <p className="whitespace-pre-wrap text-sm text-[#666666]">{p.texto || '—'}</p>
          <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Heart size={14} className="text-gray-400" aria-hidden />
              {p.total_curtidas ?? 0}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle size={14} className="text-gray-400" aria-hidden />
              {p.total_comentarios ?? 0}
            </span>
            <time className="ml-auto">
              {new Date(p.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </time>
          </div>
        </li>
      ))}
    </ul>
  )
}
