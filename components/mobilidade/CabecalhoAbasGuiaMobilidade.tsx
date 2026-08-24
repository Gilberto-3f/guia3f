'use client'

import Image from 'next/image'
import { Car, MapPin } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'

function abaCls(ativo: boolean) {
  return `relative z-10 flex min-w-0 flex-1 cursor-pointer touch-manipulation items-center justify-center gap-2 border-b-[3px] py-3 text-center text-sm font-semibold tracking-wide transition-colors sm:text-base ${
    ativo
      ? 'border-[#0097b2] text-[#0097b2]'
      : 'border-transparent text-gray-500'
  }`
}

type Props = {
  abaAtiva: 'guia' | 'mobilidade'
  /** Em /guia: troca aba sem navegar. Em /mobilidade: navega. */
  onAbaGuia?: () => void
  onAbaMobilidade?: () => void
}

/** Cabeçalho logo + abas Guia | Mobilidade (home / mobilidade para todos os perfis). */
export default function CabecalhoAbasGuiaMobilidade({
  abaAtiva,
  onAbaGuia,
  onAbaMobilidade,
}: Props) {
  const tGuia = useTranslations('Guia')
  const mostrarLogo = abaAtiva === 'guia'

  const abaGuia = (
    <>
      <MapPin className="h-5 w-5 shrink-0 sm:h-[1.35rem] sm:w-[1.35rem]" aria-hidden strokeWidth={2} />
      <span>{tGuia('tabGuia')}</span>
    </>
  )
  const abaMobilidade = (
    <>
      <Car className="h-5 w-5 shrink-0 sm:h-[1.35rem] sm:w-[1.35rem]" aria-hidden strokeWidth={2} />
      <span>{tGuia('tabMobilidade')}</span>
    </>
  )

  return (
    <header className="relative z-50 isolate shrink-0 bg-[#0097b2] pt-safe pointer-events-auto">
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

      <nav
        className="relative z-50 flex w-full border-b border-gray-200 bg-white touch-manipulation"
        aria-label={tGuia('tabGuia')}
      >
        {onAbaGuia ? (
          <button type="button" onClick={onAbaGuia} className={abaCls(abaAtiva === 'guia')}>
            {abaGuia}
          </button>
        ) : (
          <Link href="/guia" className={abaCls(abaAtiva === 'guia')}>
            {abaGuia}
          </Link>
        )}
        {onAbaMobilidade ? (
          <button
            type="button"
            onClick={onAbaMobilidade}
            className={abaCls(abaAtiva === 'mobilidade')}
          >
            {abaMobilidade}
          </button>
        ) : (
          <Link href="/mobilidade" className={abaCls(abaAtiva === 'mobilidade')}>
            {abaMobilidade}
          </Link>
        )}
      </nav>
    </header>
  )
}
