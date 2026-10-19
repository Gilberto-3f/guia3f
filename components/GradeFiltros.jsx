'use client'

import { Utensils, Ticket, ShoppingBag, Hotel, ShoppingCart, Wrench, Hourglass } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEcossistemaAtivo } from '@/context/EcossistemaAtivoContext'

/**
 * @param {{ onFiltroClick: (filtroId: string) => void }} props
 */
export default function GradeFiltros({ onFiltroClick }) {
  const t = useTranslations('Guia')
  const { ativo: ecoAtivo } = useEcossistemaAtivo()
  const tileSexto = ecoAtivo?.tile_sexto ?? 'compras_cde'

  const sexto =
    tileSexto === 'aguarde'
      ? { id: 'aguarde', nome: t('aguarde'), icon: Hourglass }
      : tileSexto === 'servicos_locais'
        ? { id: 'servicos_locais_sexto', nome: t('servicosLocais'), icon: Wrench }
        : { id: 'compras', nome: t('compras'), icon: ShoppingCart }

  const filtros = [
    { id: 'gastronomia', nome: t('gastronomia'), icon: Utensils },
    { id: 'passeios', nome: t('passeios'), icon: Ticket },
    { id: 'lojas', nome: t('lojas'), icon: ShoppingBag },
    { id: 'hospedagem', nome: t('hospedagem'), icon: Hotel },
    { id: 'servicos_locais', nome: 'Serviços', icon: Wrench },
    sexto,
  ]

  return (
    <div className="grid grid-cols-3 gap-2 p-3 sm:gap-3 sm:p-4">
      {filtros.map((filtro, idx) => {
        const Icon = filtro.icon
        const aguarde = filtro.id === 'aguarde'
        return (
          <button
            key={idx === 5 ? 'sexto' : filtro.id}
            type="button"
            onClick={() => {
              if (aguarde) return
              onFiltroClick(filtro.id)
            }}
            aria-disabled={aguarde || undefined}
            className={
              aguarde
                ? 'flex aspect-square flex-col items-center justify-center rounded-lg border border-gray-200 bg-white'
                : 'flex aspect-square flex-col items-center justify-center rounded-lg border border-gray-200 bg-white transition-shadow hover:shadow-md'
            }
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
