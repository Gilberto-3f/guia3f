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
 * }} props
 */
export default function MetricasPerfil({
  favoritosCount = 0,
  seguidoresCount = 0,
  avaliacoesCount = 0,
  onFavoritos,
  onSeguidores,
  onAvaliacoes,
}) {
  const items = [
    { icon: Heart, label: 'FAVORITOS', count: favoritosCount, onClick: onFavoritos },
    { icon: Users, label: 'SEGUIDORES', count: seguidoresCount, onClick: onSeguidores },
    { icon: Star, label: 'AVALIAÇÕES', count: avaliacoesCount, onClick: onAvaliacoes },
  ]

  return (
    <div className="grid grid-cols-3 gap-2 px-3">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <button
            key={item.label}
            type="button"
            onClick={item.onClick}
            aria-label={item.label}
            className="flex items-center justify-center gap-1 rounded-lg bg-gray-100 px-2 py-1.5 transition-colors hover:bg-gray-200"
          >
            <Icon className="h-4 w-4 text-[#0097b2]" />
            <span className="text-sm font-semibold text-[#0097b2]">{item.count}</span>
          </button>
        )
      })}
    </div>
  )
}
