'use client'

import Image from 'next/image'
import { normalizarUrlMidiaSupabase, podeUsarNextImage } from '@/lib/imagemPublica'

const DEFAULT = '/avatar-default.png'

/**
 * Foto de perfil: rotas locais (`/…`) usam `next/image`; URLs remotas usam `<img>` para evitar erro 402 no proxy Vercel.
 * @param {{
 *   src: string | null | undefined
 *   alt?: string
 *   width?: number
 *   height?: number
 *   className?: string
 *   fill?: boolean
 *   sizes?: string
 *   priority?: boolean
 * }} props
 */
export default function AvatarImage({
  src,
  alt = '',
  width = 40,
  height = 40,
  className = '',
  fill,
  sizes,
  priority = false,
}) {
  const raw = src && String(src).trim() ? String(src) : DEFAULT
  const s = raw === DEFAULT ? DEFAULT : normalizarUrlMidiaSupabase(raw) || DEFAULT
  const usarNext = podeUsarNextImage(s)

  if (fill && usarNext) {
    return <Image src={s} alt={alt} fill className={className} sizes={sizes} priority={priority} />
  }
  if (fill && !usarNext) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={s}
        alt={alt}
        className={`absolute inset-0 h-full w-full object-cover ${className}`}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
      />
    )
  }
  if (usarNext) {
    return (
      <Image
        src={s}
        alt={alt}
        width={width}
        height={height}
        className={className}
        sizes={sizes ?? `${width}px`}
        priority={priority}
      />
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={s}
      alt={alt}
      width={width}
      height={height}
      className={className}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
    />
  )
}
