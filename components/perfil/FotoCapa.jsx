'use client'

import Image from 'next/image'

/**
 * @param {{
 *   src: string | null
 *   nomeFallback?: string
 *   onOpenMenu?: () => void
 *   mostrarMenu?: boolean
 * }} props
 */
export default function FotoCapa({ src, nomeFallback = '', onOpenMenu, mostrarMenu = true }) {
  return (
    <div className="relative h-[33vh] w-full overflow-hidden bg-gradient-to-br from-[#0097b2]/40 to-[#001f3f]/60">
      {src ? (
        <Image src={src} alt="" fill className="object-cover" sizes="100vw" priority />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-white/40">{nomeFallback.charAt(0) || '?'}</div>
      )}
      {mostrarMenu && onOpenMenu ? (
        <button
          type="button"
          onClick={onOpenMenu}
          className="absolute right-4 top-4 z-10 rounded-full bg-black/30 px-3 py-2 text-lg font-bold leading-none text-white backdrop-blur-sm"
          aria-label="Menu"
        >
          ☰⋮
        </button>
      ) : null}
    </div>
  )
}
