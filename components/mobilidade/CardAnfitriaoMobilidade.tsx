'use client'

import { useEffect, useState } from 'react'
import { Briefcase, Car, ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import DrawerEspacoProfissionalMobilidade from '@/components/mobilidade/DrawerEspacoProfissionalMobilidade'

const COR = '#0097b2'
const VERDE = '#00D443'

type Props = {
  className?: string
  forcarRecolhido?: boolean
  /** Abre o card Para Onde? (mesmo fluxo do turista). */
  onChamarCorrida: () => void
}

/**
 * Card flutuante do anfitrião na Mobilidade (sem toggle online).
 * Chevron → CHAMAR CORRIDA + ESPAÇO PROFISSIONAL.
 */
export default function CardAnfitriaoMobilidade({
  className = '',
  forcarRecolhido = false,
  onChamarCorrida,
}: Props) {
  const t = useTranslations('Mobilidade')
  const [aberto, setAberto] = useState(false)
  const [espacoAberto, setEspacoAberto] = useState(false)

  useEffect(() => {
    if (forcarRecolhido) setAberto(false)
  }, [forcarRecolhido])

  const painelAberto = aberto && !forcarRecolhido

  return (
    <>
      <div className={`w-full max-w-lg ${className}`}>
        <div
          className={`bg-white shadow-lg ring-1 ring-black/10 ${
            painelAberto ? 'rounded-2xl' : 'overflow-hidden rounded-2xl'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              if (forcarRecolhido) return
              setAberto((v) => !v)
            }}
            className={`flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-white ${
              painelAberto ? 'rounded-t-2xl' : 'rounded-2xl'
            }`}
            style={{ backgroundColor: COR }}
            aria-expanded={painelAberto}
            aria-label={t('anfitriaoCardTitulo')}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <Briefcase className="h-5 w-5 shrink-0 text-white" aria-hidden strokeWidth={2} />
              <p className="text-base font-extrabold uppercase tracking-wide text-white">
                {t('anfitriaoCardTitulo')}
              </p>
            </div>
            {painelAberto ? (
              <ChevronUp className="h-5 w-5 shrink-0 text-white" aria-hidden />
            ) : (
              <ChevronDown className="h-5 w-5 shrink-0 text-white" aria-hidden />
            )}
          </button>

          <div
            className={painelAberto ? 'space-y-3 px-4 py-4' : 'hidden'}
            aria-hidden={!painelAberto}
          >
            <button
              type="button"
              onClick={() => {
                setAberto(false)
                onChamarCorrida()
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-sm transition-opacity hover:opacity-95"
              style={{ backgroundColor: VERDE }}
            >
              <Car className="h-4 w-4 shrink-0" aria-hidden strokeWidth={2.5} />
              {t('chamarCorrida')}
            </button>

            <button
              type="button"
              onClick={() => setEspacoAberto(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-sm transition-opacity hover:opacity-95"
              style={{ backgroundColor: COR }}
            >
              <Briefcase className="h-4 w-4 shrink-0" aria-hidden strokeWidth={2.5} />
              {t('espacoProfissionalBotao')}
            </button>
          </div>
        </div>
      </div>

      <DrawerEspacoProfissionalMobilidade
        aberto={espacoAberto}
        onFechar={() => setEspacoAberto(false)}
        forcarModo="anfitriao"
      />
    </>
  )
}
