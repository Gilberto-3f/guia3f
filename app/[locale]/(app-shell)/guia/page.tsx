'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from '@/i18n/navigation'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { useTranslations } from 'next-intl'
import { Car, MapPin } from 'lucide-react'
import PublicidadeHome from '@/components/PublicidadeHome'
import GradeFiltros from '@/components/GradeFiltros'
import PopupFavoritos from '@/components/PopupFavoritos'

function abaGuiaCls(ativo: boolean, unica: boolean) {
  return `flex min-w-0 ${unica ? 'w-full flex-none' : 'flex-1'} items-center justify-center gap-2 border-b-[3px] py-3 text-center text-sm font-semibold tracking-wide transition-colors sm:text-base ${
    ativo
      ? 'border-[#0097b2] text-[#0097b2]'
      : 'border-transparent text-gray-500'
  }`
}

export default function GuiaPage() {
  const tMobilidade = useTranslations('Mobilidade')
  const tGuia = useTranslations('Guia')
  const router = useRouter()
  const { podeInteragir, notificarSomenteLeitura } = useModoApresentacao()
  const { perfilEhProfissional, recursosProfissionaisLiberados } = useProfissionalGate()
  const ocultarMobilidadeProfissional = perfilEhProfissional && !recursosProfissionaisLiberados
  const [abaAtiva, setAbaAtiva] = useState<'guia' | 'mobilidade'>('guia')
  const [popupFavoritosAberto, setPopupFavoritosAberto] = useState(false)

  useEffect(() => {
    if (ocultarMobilidadeProfissional && abaAtiva === 'mobilidade') {
      setAbaAtiva('guia')
    }
  }, [ocultarMobilidadeProfissional, abaAtiva])

  const handleFiltroClick = (filtroId: string) => {
    if (filtroId === 'favoritos' && !podeInteragir) {
      notificarSomenteLeitura()
      return
    }
    if (filtroId === 'favoritos') {
      setPopupFavoritosAberto(true)
    } else if (filtroId === 'compras') {
      router.push('/guia/compras')
    } else {
      router.push(`/guia/${filtroId}`)
    }
  }

  return (
    <div className="flex h-[calc(100dvh-5rem)] flex-col overflow-hidden bg-gray-50">
      <header className="shrink-0">
        <div className="flex justify-center bg-[#0097b2] py-2">
          <Image src="/logo.png" alt="Guia 3F" width={120} height={40} priority className="h-auto w-auto object-contain" />
        </div>

        <div className="flex w-full border-b border-gray-200 bg-white">
          <button
            type="button"
            onClick={() => setAbaAtiva('guia')}
            className={abaGuiaCls(abaAtiva === 'guia', ocultarMobilidadeProfissional)}
          >
            <MapPin className="h-5 w-5 shrink-0 sm:h-[1.35rem] sm:w-[1.35rem]" aria-hidden strokeWidth={2} />
            <span>{tGuia('tabGuia')}</span>
          </button>
          {!ocultarMobilidadeProfissional ? (
            <button
              type="button"
              onClick={() => setAbaAtiva('mobilidade')}
              className={abaGuiaCls(abaAtiva === 'mobilidade', false)}
            >
              <Car className="h-5 w-5 shrink-0 sm:h-[1.35rem] sm:w-[1.35rem]" aria-hidden strokeWidth={2} />
              <span>{tGuia('tabMobilidade')}</span>
            </button>
          ) : null}
        </div>
      </header>

      {abaAtiva === 'guia' ? (
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <GradeFiltros onFiltroClick={handleFiltroClick} />
            <PublicidadeHome />
          </div>
        </main>
      ) : (
        <main className="flex min-h-0 flex-1 flex-col items-center justify-start overflow-y-auto bg-gray-50 px-4 py-8 text-center">
          <p className="text-lg font-medium text-gray-600">{tMobilidade('comingSoon')}</p>
          <p className="mt-2 max-w-md text-sm text-gray-500">{tMobilidade('description')}</p>
        </main>
      )}

      <PopupFavoritos isOpen={popupFavoritosAberto} onClose={() => setPopupFavoritosAberto(false)} />
    </div>
  )
}
