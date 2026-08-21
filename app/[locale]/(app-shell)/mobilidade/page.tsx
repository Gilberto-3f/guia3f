'use client'

import { Suspense, useCallback, useMemo, useState, useEffect } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import AvisoDocsProfissionalBloqueado from '@/components/AvisoDocsProfissionalBloqueado'
import PopupAvisoBloqueioConta from '@/components/PopupAvisoBloqueioConta'
import CabecalhoAbasGuiaMobilidade from '@/components/mobilidade/CabecalhoAbasGuiaMobilidade'
import VisaoTuristaMobilidade from '@/components/mobilidade/VisaoTuristaMobilidade'
import OfertaMobilidadeListener, {
  type CorridaAtivaMobilidade,
} from '@/components/mobilidade/OfertaMobilidadeListener'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { useGateComprasReservas } from '@/lib/useGateComprasReservas'
import { ehAtendimentoImediatoAtivo } from '@/lib/mobilidadeAtendimentoAtivoEventos'
import {
  destinoVisivelNoMapa,
  marcadorDeslocamentoCorrida,
  montarTrajetoCorridaAtiva,
  pontoPartidaCorrida,
  type CorridaMapaCoords,
} from '@/lib/mobilidadeTrajetoMapa'

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
  const [corridaMapa, setCorridaMapa] = useState<CorridaMapaCoords | null>(null)

  const onCorridaProChange = useCallback((c: CorridaAtivaMobilidade | null) => {
    setCorridaMapa(c)
  }, [])

  const onCorridaTuristaChange = useCallback((c: CorridaMapaCoords | null) => {
    setCorridaMapa(c)
  }, [])

  const imediatoAtivo = Boolean(
    corridaMapa &&
      ehAtendimentoImediatoAtivo({
        status: corridaMapa.status,
        data_agendada: corridaMapa.data_agendada,
      }),
  )

  const pontoPartida = useMemo(() => pontoPartidaCorrida(corridaMapa), [corridaMapa])
  const pontoDestinoMapa = useMemo(() => destinoVisivelNoMapa(corridaMapa), [corridaMapa])
  const trajeto = useMemo(() => {
    if (!imediatoAtivo) return null
    return montarTrajetoCorridaAtiva(corridaMapa)
  }, [imediatoAtivo, corridaMapa])
  const marcadorDeslocamento = useMemo(
    () => (imediatoAtivo ? marcadorDeslocamentoCorrida(corridaMapa) : null),
    [imediatoAtivo, corridaMapa],
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

  // Profissional + turista/empresa/ADM: mesmo shell (abas + mapa + card).
  if (perfilEhProfissional) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-gray-50">
        <CabecalhoAbasGuiaMobilidade abaAtiva="mobilidade" />
        <VisaoTuristaMobilidade
          comListener={false}
          trajeto={trajeto}
          origemCorrida={pontoPartida}
          destinoCorrida={pontoDestinoMapa}
          marcadorDeslocamento={marcadorDeslocamento}
          ocultarPinsEmpresas={imediatoAtivo}
        />
        <OfertaMobilidadeListener onCorridaChange={onCorridaProChange} />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-gray-50">
      <CabecalhoAbasGuiaMobilidade abaAtiva="mobilidade" />
      <VisaoTuristaMobilidade
        trajeto={trajeto}
        origemCorrida={pontoPartida}
        destinoCorrida={pontoDestinoMapa}
        marcadorDeslocamento={marcadorDeslocamento}
        onCorridaTuristaChange={onCorridaTuristaChange}
      />
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
