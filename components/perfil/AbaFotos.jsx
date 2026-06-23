'use client'

import MediaFillImage from '@/components/MediaFillImage'

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
          <MediaFillImage src={p.url} alt="" sizes="(max-width: 768px) 33vw, 200px" />
        </button>
      ))}
    </div>
  )
}
