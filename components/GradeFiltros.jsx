'use client'

import { Utensils, Ticket, ShoppingBag, Hotel, TrendingUp, Heart } from 'lucide-react'

const filtros = [
  { id: 'gastronomia', nome: 'Gastronomia', icon: Utensils, cor: '#FF6B6B' },
  { id: 'passeios', nome: 'Passeios', icon: Ticket, cor: '#4ECDC4' },
  { id: 'lojas', nome: 'Lojas', icon: ShoppingBag, cor: '#96CEB4' },
  { id: 'hospedagem', nome: 'Hospedagem', icon: Hotel, cor: '#45B7D1' },
  { id: 'compras', nome: 'Compras Paraguai', icon: TrendingUp, cor: '#FFEAA7' },
  { id: 'favoritos', nome: 'Meus Favoritos', icon: Heart, cor: '#FF6B6B' },
]

/**
 * @param {{ onFiltroClick: (filtroId: string) => void }} props
 */
export default function GradeFiltros({ onFiltroClick }) {
  return (
    <div className="grid grid-cols-3 gap-4 p-4">
      {filtros.map((filtro) => {
        const Icon = filtro.icon
        return (
          <button
            key={filtro.id}
            type="button"
            onClick={() => onFiltroClick(filtro.id)}
            className="flex flex-col items-center gap-2 rounded-xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: `${filtro.cor}20` }}
            >
              <Icon size={24} style={{ color: filtro.cor }} />
            </div>
            <span className="text-center text-sm font-medium text-gray-700">{filtro.nome}</span>
          </button>
        )
      })}
    </div>
  )
}
