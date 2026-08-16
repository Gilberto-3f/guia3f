'use client'

import { Heart, Star, Users } from 'lucide-react'

/**
 * @param {{
 *   favoritosCount?: number
 *   seguidoresCount?: number
 *   avaliacoesCount?: number
 *   onFavoritos: () => void
 *   onSeguidores: () => void
 *   onAvaliacoes: () => void
 *   modoDiscreto?: boolean
 * }} props
 */
export default function MetricasPerfil({
  favoritosCount = 0,
  seguidoresCount = 0,
  avaliacoesCount = 0,
  onFavoritos,
  onSeguidores,
  onAvaliacoes,
  modoDiscreto = false,
}) {
  const items = modoDiscreto
    ? [
        { icon: Heart, label: 'Seguindo', count: favoritosCount, onClick: onFavoritos },
        { icon: Users, label: 'Seguidores', count: seguidoresCount, onClick: onSeguidores },
        { icon: Star, label: 'Avaliações', count: avaliacoesCount, onClick: onAvaliacoes },
      ]
    : [
        { icon: Heart, label: 'FAVORITOS', count: favoritosCount, onClick: onFavoritos },
        { icon: Users, label: 'SEGUIDORES', count: seguidoresCount, onClick: onSeguidores },
        { icon: Star, label: 'AVALIAÇÕES', count: avaliacoesCount, onClick: onAvaliacoes },
      ]

  return (
    <div
      className={`grid grid-cols-3 ${
        modoDiscreto ? 'mx-auto max-w-md gap-5 px-6' : 'gap-2 px-3'
      }`}
    >
      {items.map((item) => {
        const Icon = item.icon
        return (
          <button
            key={item.label}
            type="button"
            onClick={item.onClick}
            aria-label={item.label}
            className={
              modoDiscreto
                ? 'flex min-w-0 flex-col items-center justify-center rounded-lg px-1 py-1.5 text-center transition-colors hover:bg-gray-100 active:bg-gray-200'
                : 'flex items-center justify-center gap-1 rounded-lg bg-[#0097b2] px-2 py-1.5 transition-colors hover:bg-[#0086a0] active:bg-[#007a92]'
            }
          >
            {modoDiscreto ? (
              <>
                <span className="flex items-center justify-center gap-1.5">
                  <Icon className="h-5 w-5 text-black" strokeWidth={2} aria-hidden />
                  <span className="text-xl font-bold leading-none text-black">{item.count}</span>
                </span>
                <span className="mt-1.5 text-sm font-normal leading-none text-black">{item.label}</span>
              </>
            ) : (
              <>
                <Icon className="h-4 w-4 text-white" />
                <span className="text-sm font-semibold text-white">{item.count}</span>
              </>
            )}
          </button>
        )
      })}
    </div>
  )
}
