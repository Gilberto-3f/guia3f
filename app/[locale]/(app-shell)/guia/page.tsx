'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Abas from '@/components/Abas'
import GradeFiltros from '@/components/GradeFiltros'
import PopupFavoritos from '@/components/PopupFavoritos'

export default function GuiaPage() {
  const tHome = useTranslations('Home')
  const tMobilidade = useTranslations('Mobilidade')
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'guia' | 'mobilidade'>('guia')
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
      <header className="shrink-0 bg-[#0097b2]">
        <div className="flex justify-center py-6">
          <Image
            src="/logo.png"
            alt="Guia 3F"
            width={150}
            height={50}
            className="h-auto w-auto max-w-[150px] object-contain"
            priority
          />
        </div>
        <Abas activeTab={activeTab} onTabChange={setActiveTab} />
      </header>

      {activeTab === 'guia' ? (
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
