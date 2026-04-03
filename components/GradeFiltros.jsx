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
    <div className="grid grid-cols-3 gap-2 p-3 sm:gap-3 sm:p-4">
      {filtros.map((filtro) => {
        const Icon = filtro.icon
        return (
          <button
            key={filtro.id}
            type="button"
            onClick={() => onFiltroClick(filtro.id)}
            className="flex aspect-square flex-col items-center justify-center rounded-lg border border-gray-200 bg-white transition-shadow hover:shadow-md"
          >
            <Icon className="mb-1 h-7 w-7 shrink-0 text-[#0097b2]" strokeWidth={2} aria-hidden />
            <span className="px-1 text-center text-[11px] font-semibold leading-tight text-[#0097b2]">
              {filtro.nome}
            </span>
          </button>
        )
      })}
    </div>
  )
}
