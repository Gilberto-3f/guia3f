'use client'

import { Suspense, useEffect, useMemo } from 'react'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { Car, MapPin, Navigation } from 'lucide-react'
import AvisoDocsProfissionalBloqueado from '@/components/AvisoDocsProfissionalBloqueado'
import PopupAvisoBloqueioConta from '@/components/PopupAvisoBloqueioConta'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { useGateComprasReservas } from '@/lib/useGateComprasReservas'
import {
  parseMobilidadePesquisaSearchParams,
  pontoPreenchido,
} from '@/lib/mobilidadePesquisaParams'

function abaGuiaCls(ativo: boolean) {
  return `flex min-w-0 flex-1 items-center justify-center gap-2 border-b-[3px] py-3 text-center text-sm font-semibold tracking-wide transition-colors sm:text-base ${
    ativo
      ? 'border-[#0097b2] text-[#0097b2]'
      : 'border-transparent text-gray-500'
  }`
}

function MobilidadePageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('Mobilidade')
  const tGuia = useTranslations('Guia')
  const { perfilEhProfissional, perfilEhTurista, recursosProfissionaisLiberados, loading } =
    useProfissionalGate()
  const {
    podeComprarReservar,
    avisarBloqueio,
    avisoAberto,
    fecharAvisoBloqueio,
    mensagemBloqueio,
    tituloBloqueio,
    loading: gateLoading,
  } = useGateComprasReservas()

  const pesquisa = useMemo(
    () => parseMobilidadePesquisaSearchParams(searchParams),
    [searchParams],
  )

  useEffect(() => {
    if (!perfilEhTurista || gateLoading || podeComprarReservar) return
    avisarBloqueio()
  }, [perfilEhTurista, gateLoading, podeComprarReservar, avisarBloqueio])

  if (perfilEhProfissional && (loading || !recursosProfissionaisLiberados)) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-gray-50">
        <AvisoDocsProfissionalBloqueado />
      </div>
    )
  }

  if (perfilEhTurista && !gateLoading && !podeComprarReservar) {
    return (
      <>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-start bg-gray-50 px-4 py-10 text-center">
          <p className="text-sm text-gray-600">{t('gateBloqueio')}</p>
        </div>
        <PopupAvisoBloqueioConta
          aberto={avisoAberto || Boolean(mensagemBloqueio)}
          onFechar={() => {
            fecharAvisoBloqueio()
            router.replace('/guia')
          }}
          titulo={tituloBloqueio}
          mensagem={mensagemBloqueio}
        />
      </>
    )
  }

  const temPesquisa =
    pontoPreenchido(pesquisa.origem) ||
    pontoPreenchido(pesquisa.destino) ||
    Boolean(pesquisa.destinoEmpresaId)

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
            onClick={() => router.push('/guia')}
            className={abaGuiaCls(false)}
          >
            <MapPin className="h-5 w-5 shrink-0 sm:h-[1.35rem] sm:w-[1.35rem]" aria-hidden strokeWidth={2} />
            <span>{tGuia('tabGuia')}</span>
          </button>
          <button type="button" className={abaGuiaCls(true)} aria-current="page">
            <Car className="h-5 w-5 shrink-0 sm:h-[1.35rem] sm:w-[1.35rem]" aria-hidden strokeWidth={2} />
            <span>{tGuia('tabMobilidade')}</span>
          </button>
        </div>
      </header>

      <main className="relative flex min-h-0 flex-1 flex-col">
        <div className="absolute inset-0 bg-gradient-to-b from-[#d4eef3] via-[#e8f4f6] to-[#f0f4f5]">
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <MapPin className="mb-3 h-10 w-10 text-[#0097b2]/opacity-70" aria-hidden />
            <p className="text-base font-semibold text-[#0097b2]">{t('mapaEmBreveTitulo')}</p>
            <p className="mt-1 max-w-sm text-sm text-gray-600">{t('mapaEmBreveDesc')}</p>
          </div>
        </div>

        {temPesquisa ? (
          <div className="relative z-10 mx-3 mt-3 rounded-2xl bg-white/95 p-3 shadow-md ring-1 ring-black/5 backdrop-blur-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0097b2]">
              {t('resumoPesquisa')}
            </p>
            <div className="mt-2 space-y-1.5 text-sm text-gray-800">
              <p className="flex gap-2">
                <Navigation className="mt-0.5 h-4 w-4 shrink-0 text-[#0097b2]" aria-hidden />
                <span className="min-w-0 truncate">
                  <span className="text-gray-500">{t('origemLabel')}: </span>
                  {pesquisa.origem.nome ||
                    (pesquisa.origem.lat != null
                      ? `${pesquisa.origem.lat.toFixed(4)}, ${pesquisa.origem.lng?.toFixed(4)}`
                      : '—')}
                </span>
              </p>
              <p className="flex gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#0097b2]" aria-hidden />
                <span className="min-w-0 truncate">
                  <span className="text-gray-500">{t('destinoLabel')}: </span>
                  {pesquisa.destino.nome ||
                    (pesquisa.destinoEmpresaId
                      ? t('destinoEmpresa')
                      : pesquisa.destino.lat != null
                        ? `${pesquisa.destino.lat.toFixed(4)}, ${pesquisa.destino.lng?.toFixed(4)}`
                        : '—')}
                </span>
              </p>
            </div>
            {pesquisa.abrirPesquisa ? (
              <p className="mt-2 text-xs text-gray-500">{t('popupProximaEtapa')}</p>
            ) : null}
          </div>
        ) : null}
      </main>
    </div>
  )
}

export default function MobilidadePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-0 flex-1 items-center justify-center bg-gray-50">
          <p className="animate-pulse text-sm text-gray-400">…</p>
        </div>
      }
    >
      <MobilidadePageInner />
    </Suspense>
  )
}
