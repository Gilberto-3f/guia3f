'use client'

import Link from 'next/link'

/**
 * @param {{
 *   itens: {
 *     id: string
 *     created_at: string
 *     texto: string | null
 *     originalId: string | null
 *     autorOriginal: string | null
 *     usernameOriginal: string | null
 *   }[]
 * }} props
 */
export default function AbaRepublicados({ itens }) {
  if (itens.length === 0) {
    return <p className="py-12 text-center text-sm text-gray-400">Nenhum republicado</p>
  }

  return (
    <ul className="space-y-3 px-3">
      {itens.map((item) => {
        const prev = (item.texto || '').split('\n').slice(0, 2).join(' ').slice(0, 160)
        return (
          <li key={item.id} className="rounded-lg border border-[#E0E0E0] bg-white p-3 shadow-sm">
            <p className="text-xs text-gray-500">
              Republicado ·{' '}
              {item.autorOriginal ? (
                <>
                  <span className="font-medium text-[#001f3f]">{item.autorOriginal}</span>
                  {item.usernameOriginal ? <span> @{item.usernameOriginal}</span> : null}
                </>
              ) : (
                'Post original'
              )}
            </p>
            <p className="mt-1 text-sm text-[#666666]">{prev || '—'}</p>
            <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
              <time>{new Date(item.created_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</time>
              {item.originalId ? (
                <Link href={`/feed?post=${encodeURIComponent(item.originalId)}`} className="font-medium text-[#0097b2]">
                  Ver original
                </Link>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
