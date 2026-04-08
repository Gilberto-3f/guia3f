'use client'

import Image from 'next/image'

/**
 * @param {{
 *   urls: string[]
 *   max?: number
 *   onClickFoto?: (indice: number) => void
 * }} props
 */
export default function GridFotos({ urls, max = 10, onClickFoto }) {
  const slice = urls.slice(0, max)

  return (
    <div className="grid max-w-[calc(5*60px+4*4px)] grid-cols-5 gap-1">
      {slice.map((url, i) => (
        <button
          key={`${url}-${i}`}
          type="button"
          onClick={() => onClickFoto?.(i)}
          className="relative aspect-square w-full max-w-[60px] shrink-0 overflow-hidden rounded-full bg-gray-100"
          aria-label={`Foto ${i + 1}`}
        >
          <Image src={url} alt="" fill className="object-cover" sizes="60px" />
        </button>
      ))}
    </div>
  )
}
