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
    { icon: <Heart className="h-6 w-6" />, label: 'FAVORITOS', count: favoritosCount, onClick: onFavoritos },
    { icon: <Users className="h-6 w-6" />, label: 'SEGUIDORES', count: seguidoresCount, onClick: onSeguidores },
    { icon: <Star className="h-6 w-6" />, label: 'AVALIAÇÕES', count: avaliacoesCount, onClick: onAvaliacoes },
  ]

  return (
    <div className="grid grid-cols-3 gap-2 px-3">
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={item.onClick}
          aria-label={item.label}
          className="flex flex-col items-center justify-center rounded-lg bg-gray-100 py-2 transition-colors hover:bg-gray-200"
        >
          <span className="text-2xl">{item.icon}</span>
          <span className="text-sm font-semibold text-gray-800">{item.count}</span>
        </button>
      ))}
    </div>
  )
}
