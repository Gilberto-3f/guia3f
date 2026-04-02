'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
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

        <div className="border-b border-[#0097b2]">
          <div className="flex w-full items-stretch gap-0">
            <button
              type="button"
              onClick={() => setAbaAtiva('guia')}
              className={`min-w-0 flex-1 rounded-none py-1.5 text-center text-sm font-semibold transition-colors sm:py-2 ${
                abaAtiva === 'guia'
                  ? 'bg-white text-[#0097b2]'
                  : 'border-y border-l border-r-0 border-gray-300/80 bg-gray-200 text-gray-600'
              }`}
            >
              {tGuia('tabGuia')}
            </button>
            <button
              type="button"
              onClick={() => setAbaAtiva('mobilidade')}
              className={`min-w-0 flex-1 rounded-none py-1.5 text-center text-sm font-semibold transition-colors sm:py-2 ${
                abaAtiva === 'mobilidade'
                  ? 'bg-white text-[#0097b2]'
                  : 'border-y border-r border-l-0 border-gray-300/80 bg-gray-200 text-gray-600'
              }`}
            >
              {tGuia('tabMobilidade')}
            </button>
          </div>
        </div>
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
