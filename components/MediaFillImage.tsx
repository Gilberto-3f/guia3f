'use client'

import type { SyntheticEvent } from 'react'
import Image from 'next/image'
import { normalizarUrlMidiaSupabase, podeUsarNextImage, urlMidiaValida } from '@/lib/imagemPublica'

type Props = {
  src: string | null | undefined
  alt?: string
  className?: string
  priority?: boolean
  sizes?: string
  objectFit?: 'cover' | 'contain'
  onLoad?: (event: SyntheticEvent<HTMLImageElement>) => void
}

/** Imagem responsiva (fill) com fallback para <img> quando a URL não é segura para next/image. */
export default function MediaFillImage({
  src,
  alt = '',
  className = 'object-cover',
  priority = false,
  sizes = '100vw',
  objectFit = 'cover',
  onLoad,
}: Props) {
  const s = urlMidiaValida(src) ? normalizarUrlMidiaSupabase(src) : ''

  if (!s) {
    return null
  }

  const fitClass = objectFit === 'contain' ? 'object-contain' : 'object-cover'

  if (podeUsarNextImage(s)) {
    return (
      <Image
        src={s}
        alt={alt}
        fill
        className={`${fitClass} ${className}`.trim()}
        priority={priority}
        sizes={sizes}
        onLoad={onLoad}
      />
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={s}
      alt={alt}
      className={`absolute inset-0 h-full w-full ${fitClass} ${className}`.trim()}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      onLoad={onLoad}
    />
  )
}
