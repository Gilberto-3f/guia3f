'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { Car, MapPin } from 'lucide-react'
import PublicidadeHome from '@/components/PublicidadeHome'
import GradeFiltros from '@/components/GradeFiltros'
import BarrasPesquisaMobilidade from '@/components/mobilidade/BarrasPesquisaMobilidade'

function abaGuiaCls(ativo: boolean) {
  return `flex min-w-0 flex-1 items-center justify-center gap-2 border-b-[3px] py-3 text-center text-sm font-semibold tracking-wide transition-colors sm:text-base ${
    ativo
      ? 'border-[#0097b2] text-[#0097b2]'
      : 'border-transparent text-gray-500'
  }`
}

export default function GuiaPage() {
  const tGuia = useTranslations('Guia')
  const router = useRouter()

  const [abaAtiva, setAbaAtiva] = useState<'guia' | 'mobilidade'>('guia')

  const handleFiltroClick = (filtroId: string) => {
    if (filtroId === 'compras') {
      router.push('/compras-cde')
      return
    }
    router.push(`/guia/${filtroId}`)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-50">
      <header className="shrink-0 bg-[#0097b2] pt-safe">
        <div className="flex justify-center py-4">
          <Image
            src="/logo.png"
            alt="Guia 3F"
            width={228}
            height={76}
            priority
            className="h-auto w-auto max-h-[76px] max-w-[228px] object-contain"
          />
        </div>

        <div className="flex w-full border-b border-gray-200 bg-white">
          <button
            type="button"
            onClick={() => setAbaAtiva('guia')}
            className={abaGuiaCls(abaAtiva === 'guia')}
          >
            <MapPin className="h-5 w-5 shrink-0 sm:h-[1.35rem] sm:w-[1.35rem]" aria-hidden strokeWidth={2} />
            <span>{tGuia('tabGuia')}</span>
          </button>
          <button
            type="button"
            onClick={() => setAbaAtiva('mobilidade')}
            className={abaGuiaCls(abaAtiva === 'mobilidade')}
          >
            <Car className="h-5 w-5 shrink-0 sm:h-[1.35rem] sm:w-[1.35rem]" aria-hidden strokeWidth={2} />
            <span>{tGuia('tabMobilidade')}</span>
          </button>
        </div>
      </header>

      {abaAtiva === 'guia' ? (
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <GradeFiltros onFiltroClick={handleFiltroClick} />
            <p className="mb-1 mt-2 text-center text-xs text-[#0097b2]">Espaço Publicitário</p>
            <PublicidadeHome />
          </div>
        </main>
      ) : (
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-gray-50 px-4 py-6">
          <BarrasPesquisaMobilidade />
        </main>
      )}
    </div>
  )
}
