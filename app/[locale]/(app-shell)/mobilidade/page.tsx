'use client'

import { Suspense, useCallback, useMemo, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import AvisoDocsProfissionalBloqueado from '@/components/AvisoDocsProfissionalBloqueado'
import PopupAvisoBloqueioConta from '@/components/PopupAvisoBloqueioConta'
import PainelTrabalhoMobilidade from '@/components/mobilidade/PainelTrabalhoMobilidade'
import CabecalhoAbasGuiaMobilidade from '@/components/mobilidade/CabecalhoAbasGuiaMobilidade'
import VisaoTuristaMobilidade from '@/components/mobilidade/VisaoTuristaMobilidade'
import OfertaMobilidadeListener, {
  type CorridaAtivaMobilidade,
} from '@/components/mobilidade/OfertaMobilidadeListener'
import MapaMobilidade from '@/components/mobilidade/MapaMobilidade'
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
  const [corridaMapa, setCorridaMapa] = useState<CorridaAtivaMobilidade | null>(null)

  const onCorridaChange = useCallback((c: CorridaAtivaMobilidade | null) => {
    setCorridaMapa(c)
  }, [])

  const pontoPartida = useMemo(() => {
    if (
      corridaMapa?.lat_origem == null ||
      corridaMapa?.lng_origem == null ||
      !Number.isFinite(corridaMapa.lat_origem) ||
      !Number.isFinite(corridaMapa.lng_origem)
    ) {
      return null
    }
    return {
      lat: corridaMapa.lat_origem,
      lng: corridaMapa.lng_origem,
      label: corridaMapa.origem_nome || undefined,
    }
  }, [corridaMapa])

  const pontoDestino = useMemo(() => {
    if (
      corridaMapa?.lat_destino == null ||
      corridaMapa?.lng_destino == null ||
      !Number.isFinite(corridaMapa.lat_destino) ||
      !Number.isFinite(corridaMapa.lng_destino)
    ) {
      return null
    }
    return {
      lat: corridaMapa.lat_destino,
      lng: corridaMapa.lng_destino,
      label: corridaMapa.destino_nome || undefined,
    }
  }, [corridaMapa])

  const pontoProf = useMemo(() => {
    if (
      corridaMapa?.prof_lat == null ||
      corridaMapa?.prof_lng == null ||
      !Number.isFinite(corridaMapa.prof_lat) ||
      !Number.isFinite(corridaMapa.prof_lng)
    ) {
      return null
    }
    return { lat: corridaMapa.prof_lat, lng: corridaMapa.prof_lng }
  }, [corridaMapa])

  const statusCorrida = String(corridaMapa?.status ?? '')
  const emViagem = statusCorrida === 'em_viagem'

  const trajeto = useMemo(() => {
    if (emViagem) {
      if (pontoPartida && pontoDestino) return { de: pontoPartida, ate: pontoDestino }
      if (pontoProf && pontoDestino) return { de: pontoProf, ate: pontoDestino }
      return null
    }
    if (!pontoProf || !pontoPartida) return null
    return { de: pontoProf, ate: pontoPartida }
  }, [emViagem, pontoProf, pontoPartida, pontoDestino])

  const centroMapa = emViagem
    ? pontoDestino ?? pontoPartida ?? pontoProf
    : pontoProf ?? pontoPartida

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
        <div className="relative min-h-0 flex-1">
          <MapaMobilidade
            empresas={[]}
            centro={centroMapa}
            origem={pontoPartida}
            destino={emViagem ? pontoDestino : null}
            trajeto={trajeto}
            ocultarAvisoEmpresas
            className="h-full min-h-[240px]"
          />
        </div>
        <OfertaMobilidadeListener onCorridaChange={onCorridaChange} />
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
