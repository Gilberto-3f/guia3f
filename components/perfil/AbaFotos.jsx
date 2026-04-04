'use client'

import Image from 'next/image'

/**
 * @param {{
 *   posts: { id: string, url: string }[]
 *   onOpen: (index: number) => void
 * }} props
 */
export default function AbaFotos({ posts, onOpen }) {
  if (posts.length === 0) {
    return <p className="py-12 text-center text-sm text-gray-400">Nenhuma foto publicada</p>
  }

  return (
    <div className="grid grid-cols-3 gap-1 px-1">
      {posts.map((p, idx) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onOpen(idx)}
          className="relative aspect-square overflow-hidden bg-gray-100"
        >
          <Image src={p.url} alt="" fill className="object-cover" sizes="(100vw/3)" />
        </button>
      ))}
    </div>
  )
}
