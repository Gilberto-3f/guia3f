'use client'

import { Suspense } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import AvisoDocsProfissionalBloqueado from '@/components/AvisoDocsProfissionalBloqueado'
import PopupAvisoBloqueioConta from '@/components/PopupAvisoBloqueioConta'
import PainelTrabalhoMobilidade from '@/components/mobilidade/PainelTrabalhoMobilidade'
import CabecalhoAbasGuiaMobilidade from '@/components/mobilidade/CabecalhoAbasGuiaMobilidade'
import VisaoTuristaMobilidade from '@/components/mobilidade/VisaoTuristaMobilidade'
import OfertaMobilidadeListener from '@/components/mobilidade/OfertaMobilidadeListener'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { useGateComprasReservas } from '@/lib/useGateComprasReservas'
import { useEffect } from 'react'

function MobilidadePageInner() {
  const router = useRouter()
  const t = useTranslations('Mobilidade')
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

  if (perfilEhProfissional) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#e8f4f6]">
        <div className="relative z-10 shrink-0 pt-safe">
          <PainelTrabalhoMobilidade />
        </div>
        <OfertaMobilidadeListener />
      </div>
    )
  }

  // Turista / empresa / ADM: abas da home + mapa + Para Onde?
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-gray-50">
      <CabecalhoAbasGuiaMobilidade abaAtiva="mobilidade" />
      <VisaoTuristaMobilidade />
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
