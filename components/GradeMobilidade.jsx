'use client'

import { Bus, Car, Map, Building2, Bike, ParkingCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

export default function GradeMobilidade() {
  const t = useTranslations('Mobilidade')
  const router = useRouter()
  const itens = [
    { id: 'onibus', nome: t('gridOnibus'), icon: Bus },
    { id: 'taxi', nome: t('gridTaxi'), icon: Car },
    { id: 'mapas', nome: t('gridMapas'), icon: Map },
    { id: 'rodoviaria', nome: t('gridRodoviaria'), icon: Building2 },
    { id: 'bike', nome: t('gridBike'), icon: Bike },
    { id: 'estacionamento', nome: t('gridEstacionamento'), icon: ParkingCircle },
  ]

  return (
    <div className="grid grid-cols-3 gap-3 p-4">
      {itens.map((item) => {
        const Icon = item.icon
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => router.push('/mobilidade')}
            className="flex w-full min-w-0 flex-col items-center justify-center rounded-none border border-gray-200 bg-white py-4 transition-shadow hover:shadow-md"
          >
            <Icon className="mb-1 h-8 w-8 shrink-0 text-[#0097b2]" strokeWidth={2} aria-hidden />
            <span className="px-1 text-center text-[11px] font-semibold leading-tight text-[#0097b2]">
              {item.nome}
            </span>
          </button>
        )
      })}
    </div>
  )
}
