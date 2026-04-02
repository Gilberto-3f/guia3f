'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Car, MapPin } from 'lucide-react'
import GradeFiltros from '@/components/GradeFiltros'
import PopupFavoritos from '@/components/PopupFavoritos'

export default function GuiaPage() {
  const tHome = useTranslations('Home')
  const tMobilidade = useTranslations('Mobilidade')
  const tGuia = useTranslations('Guia')
  const router = useRouter()
  const [abaAtiva, setAbaAtiva] = useState<'guia' | 'mobilidade'>('guia')
  const [popupFavoritosAberto, setPopupFavoritosAberto] = useState(false)

  const handleFiltroClick = (filtroId: string) => {
    if (filtroId === 'favoritos') {
      setPopupFavoritosAberto(true)
    } else if (filtroId === 'compras') {
      router.push('/guia/compras')
    } else {
      router.push(`/guia/${filtroId}`)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="shrink-0">
        <div className="flex justify-center bg-[#0097b2] py-2">
          <Image src="/logo.png" alt="Guia 3F" width={120} height={40} priority className="h-auto w-auto object-contain" />
        </div>

        <div className="h-px w-full shrink-0 bg-white" aria-hidden />
        <div className="flex w-full items-stretch gap-0">
          <button
            type="button"
            onClick={() => setAbaAtiva('guia')}
            className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-none px-2 py-2 text-center text-base transition-colors sm:gap-2.5 sm:py-2.5 ${
              abaAtiva === 'guia'
                ? 'bg-white font-bold text-[#0097b2]'
                : 'border-b border-l border-r-0 border-gray-400/50 bg-[#d9dce2] font-normal text-white'
            }`}
          >
            <MapPin className="h-5 w-5 shrink-0 opacity-95 sm:h-[1.35rem] sm:w-[1.35rem]" aria-hidden />
            <span>{tGuia('tabGuia')}</span>
          </button>
          <button
            type="button"
            onClick={() => setAbaAtiva('mobilidade')}
            className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-none px-2 py-2 text-center text-base transition-colors sm:gap-2.5 sm:py-2.5 ${
              abaAtiva === 'mobilidade'
                ? 'bg-white font-bold text-[#0097b2]'
                : 'border-b border-r border-l-0 border-gray-400/50 bg-[#d9dce2] font-normal text-white'
            }`}
          >
            <Car className="h-5 w-5 shrink-0 opacity-95 sm:h-[1.35rem] sm:w-[1.35rem]" aria-hidden />
            <span>{tGuia('tabMobilidade')}</span>
          </button>
        </div>
        <div className="h-px w-full shrink-0 bg-[#0097b2]" aria-hidden />
      </header>

      {abaAtiva === 'guia' ? (
        <main className="flex flex-1 flex-col">
          <GradeFiltros onFiltroClick={handleFiltroClick} />

          <div className="p-4 pt-0">
            <div className="rounded-lg bg-gray-100 p-8 text-center">
              <p className="font-medium text-gray-400">{tHome('adSpace')}</p>
              <p className="mt-1 text-sm text-gray-400">{tHome('adHere')}</p>
            </div>
          </div>
        </main>
      ) : (
        <main className="flex flex-1 flex-col items-center justify-start bg-gray-50 px-4 py-8 text-center">
          <p className="text-lg font-medium text-gray-600">{tMobilidade('comingSoon')}</p>
          <p className="mt-2 max-w-md text-sm text-gray-500">{tMobilidade('description')}</p>
        </main>
      )}

      <PopupFavoritos isOpen={popupFavoritosAberto} onClose={() => setPopupFavoritosAberto(false)} />
    </div>
  )
}
