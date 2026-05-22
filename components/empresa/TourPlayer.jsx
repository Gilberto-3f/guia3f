'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import {
  filtrarHotspotsNavegacao,
  getPrimeiraCena,
  parseTourConfig,
  preloadPanorama,
  sincronizarTourComFotos,
  tourTemNavegacao,
} from '@/lib/pannellumTour'

const TourPannellumView = dynamic(() => import('@/components/empresa/TourPannellumView'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full flex-1 items-center justify-center text-sm text-white">Carregando tour…</div>
  ),
})

/**
 * @param {{
 *   fotos360Url: string[]
 *   tourConfig: import('@/lib/tour360Types').TourConfig | unknown
 *   autoOpen?: boolean
 *   onFechar?: () => void
 * }} props
 */
export default function TourPlayer({ fotos360Url, tourConfig: tourConfigRaw, autoOpen = true, onFechar }) {
  const urls = useMemo(
    () => (Array.isArray(fotos360Url) ? fotos360Url.filter((u) => typeof u === 'string' && u.trim()) : []),
    [fotos360Url]
  )
  const tour = useMemo(() => sincronizarTourComFotos(urls, parseTourConfig(tourConfigRaw)), [tourConfigRaw, urls])

  const temTour = tour.cenas.length > 0
  const temNavegacao = tourTemNavegacao(tour)
  const idsCenasValidos = useMemo(() => new Set(tour.cenas.map((c) => c.id)), [tour.cenas])

  const primeiraCena = useMemo(() => getPrimeiraCena(tour), [tour])
  const [cenaId, setCenaId] = useState(() => primeiraCena?.id ?? '')
  const pannellumRef = useRef(/** @type {import('pannellum-react').Pannellum | null} */ (null))
  const [fechado, setFechado] = useState(false)
  const [erro, setErro] = useState('')
  const [panoramaPronto, setPanoramaPronto] = useState(false)

  const cenaAtual = tour.cenas.find((c) => c.id === cenaId) ?? primeiraCena
  const hotspots = useMemo(
    () => (cenaAtual ? filtrarHotspotsNavegacao(cenaAtual, idsCenasValidos) : []),
    [cenaAtual, idsCenasValidos]
  )

  const mostrarFullscreen = temTour && !fechado && Boolean(cenaAtual?.url)

  const fechar = useCallback(() => {
    setFechado(true)
    onFechar?.()
  }, [onFechar])

  const reabrir = useCallback(() => {
    setFechado(false)
    setErro('')
    setPanoramaPronto(false)
  }, [])

  const carregarCena = useCallback(
    async (sceneId) => {
      if (!idsCenasValidos.has(sceneId)) return
      const destino = tour.cenas.find((c) => c.id === sceneId)
      if (!destino?.url) return
      setPanoramaPronto(false)
      try {
        await preloadPanorama(destino.url)
      } catch {
        /* continua */
      }
      setCenaId(sceneId)
    },
    [idsCenasValidos, tour.cenas]
  )

  useEffect(() => {
    if (autoOpen && temTour) setFechado(false)
  }, [autoOpen, temTour, tour])

  useEffect(() => {
    const id = primeiraCena?.id ?? ''
    if (id) setCenaId(id)
  }, [primeiraCena?.id, tour])

  useEffect(() => {
    if (!mostrarFullscreen || !cenaAtual?.url) return

    let cancelado = false
    setErro('')
    setPanoramaPronto(false)

    const run = async () => {
      try {
        await preloadPanorama(cenaAtual.url)
        if (!cancelado) setPanoramaPronto(true)
      } catch {
        if (!cancelado) {
          setPanoramaPronto(true)
          setErro('Não foi possível pré-carregar o panorama.')
        }
      }
    }

    void run()
    return () => {
      cancelado = true
    }
  }, [mostrarFullscreen, cenaAtual?.url])

  const onPanoramaLoad = useCallback(() => {
    setErro('')
    requestAnimationFrame(() => {
      pannellumRef.current?.forceRender?.()
    })
  }, [])

  const onPanoramaError = useCallback(() => {
    setErro('Não foi possível carregar o tour virtual.')
  }, [])

  if (!urls.length) {
    return <p className="py-10 text-center text-sm text-gray-500">Nenhuma imagem 360° cadastrada</p>
  }

  if (!temTour) {
    return <p className="py-10 text-center text-sm text-gray-500">Nenhum tour virtual cadastrado</p>
  }

  if (fechado) {
    return (
      <div className="py-4 text-center">
        <p className="mb-3 text-sm font-medium text-[#001f3f]">{temNavegacao ? 'Tour Virtual' : 'Vista 360°'}</p>
        <button
          type="button"
          onClick={reabrir}
          className="rounded-lg bg-[#0097b2] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95"
        >
          {temNavegacao ? 'Iniciar tour virtual' : 'Abrir vista 360°'}
        </button>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[140] flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="Tour virtual 360 graus"
    >
      <button
        type="button"
        onClick={fechar}
        className="absolute right-3 top-3 z-20 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
        aria-label="Fechar"
      >
        <X className="h-6 w-6" aria-hidden />
      </button>
      {erro && !panoramaPronto ? (
        <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-white">{erro}</div>
      ) : !panoramaPronto || !cenaAtual ? (
        <div className="flex flex-1 items-center justify-center text-sm text-white">Carregando tour…</div>
      ) : (
        <>
          <div className="relative h-full w-full min-h-0 flex-1">
            <TourPannellumView
              key={cenaAtual.id}
              cena={cenaAtual}
              hotspots={hotspots}
              onNavigate={(sceneId) => void carregarCena(sceneId)}
              onLoad={onPanoramaLoad}
              onError={onPanoramaError}
              viewerRef={pannellumRef}
            />
          </div>
          {erro ? (
            <p className="pointer-events-none absolute top-14 left-0 right-0 z-20 px-4 text-center text-xs text-amber-200">
              {erro}
            </p>
          ) : null}
          {temNavegacao ? (
            <p className="pointer-events-none absolute bottom-4 left-0 right-0 z-20 px-4 text-center text-xs text-white/90 drop-shadow">
              Toque nas setas para ir ao próximo ambiente
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}
