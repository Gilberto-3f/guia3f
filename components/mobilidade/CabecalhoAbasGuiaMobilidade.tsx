'use client'

import Image from 'next/image'
import { Car, MapPin } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'

function abaCls(ativo: boolean) {
  return `flex min-w-0 flex-1 items-center justify-center gap-2 border-b-[3px] py-3 text-center text-sm font-semibold tracking-wide transition-colors sm:text-base ${
    ativo
      ? 'border-[#0097b2] text-[#0097b2]'
      : 'border-transparent text-gray-500'
  }`
}

type Props = {
  abaAtiva: 'guia' | 'mobilidade'
  /** Em /guia: troca aba sem navegar. Em /mobilidade: usa links. */
  onAbaGuia?: () => void
  onAbaMobilidade?: () => void
}

/** Cabeçalho logo + abas Guia | Mobilidade (visão turista/empresa/ADM). */
export default function CabecalhoAbasGuiaMobilidade({
  abaAtiva,
  onAbaGuia,
  onAbaMobilidade,
}: Props) {
  const tGuia = useTranslations('Guia')

  const mostrarLogo = abaAtiva === 'guia'

  return (
    <header className="shrink-0 bg-[#0097b2] pt-safe">
      {mostrarLogo ? (
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
      ) : null}

      <div className="flex w-full border-b border-gray-200 bg-white">
        {onAbaGuia ? (
          <button type="button" onClick={onAbaGuia} className={abaCls(abaAtiva === 'guia')}>
            <MapPin className="h-5 w-5 shrink-0 sm:h-[1.35rem] sm:w-[1.35rem]" aria-hidden strokeWidth={2} />
            <span>{tGuia('tabGuia')}</span>
          </button>
        ) : (
          <Link href="/guia" className={abaCls(abaAtiva === 'guia')}>
            <MapPin className="h-5 w-5 shrink-0 sm:h-[1.35rem] sm:w-[1.35rem]" aria-hidden strokeWidth={2} />
            <span>{tGuia('tabGuia')}</span>
          </Link>
        )}
        {onAbaMobilidade ? (
          <button
            type="button"
            onClick={onAbaMobilidade}
            className={abaCls(abaAtiva === 'mobilidade')}
          >
            <Car className="h-5 w-5 shrink-0 sm:h-[1.35rem] sm:w-[1.35rem]" aria-hidden strokeWidth={2} />
            <span>{tGuia('tabMobilidade')}</span>
          </button>
        ) : (
          <Link href="/mobilidade" className={abaCls(abaAtiva === 'mobilidade')}>
            <Car className="h-5 w-5 shrink-0 sm:h-[1.35rem] sm:w-[1.35rem]" aria-hidden strokeWidth={2} />
            <span>{tGuia('tabMobilidade')}</span>
          </Link>
        )}
      </div>
    </header>
  )
}
