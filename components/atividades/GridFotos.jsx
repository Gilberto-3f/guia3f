'use client'

import MediaFillImage from '@/components/MediaFillImage'
import { normalizarUrlMidiaSupabase, urlMidiaValida } from '@/lib/imagemPublica'

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
    <div className="grid max-w-[calc(5*52px+4*4px)] grid-cols-5 gap-1">
      {slice.map((url, i) => {
        const src = urlMidiaValida(url) ? normalizarUrlMidiaSupabase(url) : ''
        return (
          <button
            key={`${url}-${i}`}
            type="button"
            onClick={() => onClickFoto?.(i)}
            className="relative aspect-square w-full max-w-[52px] shrink-0 overflow-hidden rounded-md bg-gray-100"
            aria-label={`Foto ${i + 1}`}
          >
            {src ? (
              <MediaFillImage src={src} alt="" sizes="52px" />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-400">—</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
