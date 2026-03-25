'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Logo from '@/components/Logo'
import Abas from '@/components/Abas'
import GradeFiltros from '@/components/GradeFiltros'
import PopupFavoritos from '@/components/PopupFavoritos'

export default function GuiaPage() {
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
    <div className="min-h-screen bg-[#0097b2] p-4">
      <div className="mx-auto w-full max-w-5xl bg-white rounded-2xl border-2 border-[#0097b2] shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1)] overflow-hidden">
        <Logo />
        <Abas activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === 'guia' ? (
          <>
            <GradeFiltros onFiltroClick={handleFiltroClick} />

            <div className="mx-4 mb-6 rounded-xl bg-gray-100 p-4 text-center">
              <p className="text-sm text-gray-400">ESPAÇO PUBLICITÁRIO</p>
              <p className="mt-1 text-xs text-gray-300">Anuncie aqui</p>
            </div>
          </>
        ) : (
          <div className="p-8 text-center">
            <p className="text-gray-400">Em breve</p>
          </div>
        )}

        <PopupFavoritos isOpen={popupFavoritosAberto} onClose={() => setPopupFavoritosAberto(false)} />
      </div>
    </div>
  )
}
