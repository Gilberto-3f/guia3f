'use client'

import Image from 'next/image'

/**
 * @param {{
 *   urls: string[]
 *   onOpen: (index: number) => void
 * }} props
 */
export default function AbaFotos({ urls, onOpen }) {
  if (urls.length === 0) {
    return <p className="py-12 text-center text-sm text-gray-400">Nenhuma foto publicada</p>
  }

  return (
    <div className="grid grid-cols-3 gap-1 px-1">
      {urls.map((u, idx) => (
        <button
          key={`${u}-${idx}`}
          type="button"
          onClick={() => onOpen(idx)}
          className="relative aspect-square overflow-hidden bg-gray-100"
        >
          <Image src={u} alt="" fill className="object-cover" sizes="(100vw/3)" />
        </button>
      ))}
    </div>
  )
}
