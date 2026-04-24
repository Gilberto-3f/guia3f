'use client'

import Image from 'next/image'

/**
 * @param {{ fotoUrl: string | null, nome: string, onOpenMenu?: () => void, mostrarMenu?: boolean }} props
 */
export default function FotoHero({ fotoUrl, nome, onOpenMenu, mostrarMenu = false }) {
  return (
    <div
      className={`relative aspect-square w-full overflow-hidden ${
        fotoUrl ? 'bg-gray-100' : 'bg-gradient-to-br from-[#0097b2]/40 to-[#001f3f]/60'
      }`}
    >
      {fotoUrl ? (
        <Image src={fotoUrl} alt={nome} fill className="object-cover" priority sizes="100vw" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-white/40">
          {nome.trim().charAt(0) || '?'}
        </div>
      )}
      {mostrarMenu && onOpenMenu ? (
        <button
          type="button"
          onClick={onOpenMenu}
          className="absolute right-3 top-3 z-10 rounded-full bg-black/30 px-3 py-2 text-lg font-bold leading-none text-white backdrop-blur-sm"
          aria-label="Menu"
        >
          ☰⋮
        </button>
      ) : null}
    </div>
  )
}
