'use client'

import Image from 'next/image'

const DEFAULT = '/avatar-default.png'

/**
 * Foto de perfil: rotas locais (`/…`) usam `next/image`; URLs remotas usam `<img>` para evitar erro quando o host não está em `remotePatterns`.
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
  const s = src && String(src).trim() ? String(src) : DEFAULT
  const isLocal = s.startsWith('/') || s.startsWith('data:')

  if (fill && isLocal) {
    return <Image src={s} alt={alt} fill className={className} sizes={sizes} priority={priority} />
  }
  if (fill && !isLocal) {
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
  if (isLocal) {
    return <Image src={s} alt={alt} width={width} height={height} className={className} />
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={s} alt={alt} width={width} height={height} className={className} />
  )
}
