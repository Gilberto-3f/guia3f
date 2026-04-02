'use client'

import { Utensils, Ticket, ShoppingBag, Hotel, ShoppingCart, Heart } from 'lucide-react'
import { useTranslations } from 'next-intl'

/**
 * @param {{ onFiltroClick: (filtroId: string) => void }} props
 */
export default function GradeFiltros({ onFiltroClick }) {
  const t = useTranslations('Guia')
  const filtros = [
    { id: 'gastronomia', nome: t('gastronomia'), icon: Utensils },
    { id: 'passeios', nome: t('passeios'), icon: Ticket },
    { id: 'lojas', nome: t('lojas'), icon: ShoppingBag },
    { id: 'hospedagem', nome: t('hospedagem'), icon: Hotel },
    { id: 'compras', nome: t('compras'), icon: ShoppingCart },
    { id: 'favoritos', nome: t('favoritos'), icon: Heart },
  ]

  return (
    <div className="grid grid-cols-3 gap-4 p-4">
      {filtros.map((filtro) => {
        const Icon = filtro.icon
        return (
          <button
            key={filtro.id}
            type="button"
            onClick={() => onFiltroClick(filtro.id)}
            className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white py-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <Icon className="mb-2 h-8 w-8 shrink-0 text-[#001f3f]" strokeWidth={2} aria-hidden />
            <span className="text-center text-xs font-semibold uppercase leading-tight text-[#001f3f] sm:text-sm">
              {filtro.nome}
            </span>
          </button>
        )
      })}
    </div>
  )
}
