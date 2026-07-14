'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import {
  buildPannellumTourConfig,
  getPannellum,
  getPrimeiraCena,
  loadPannellumAssets,
  parseTourConfig,
  preloadPanorama,
  sincronizarTourComFotos,
} from '@/lib/pannellumTour'

/**
 * Visitante: panoramas 360° com carrossel de miniaturas (sem hotspots/setas).
 *
 * @param {{
 *   fotos360Url: string[]
 *   tourConfig: import('@/lib/tour360Types').TourConfig | unknown
 *   autoOpen?: boolean
 *   onFechar?: () => void
 *   painelAntesIniciar?: import('react').ReactNode
 * }} props
 */
export default function TourPlayer({
  fotos360Url,
  tourConfig: tourConfigRaw,
  autoOpen = true,
  onFechar,
  painelAntesIniciar = null,
}) {
  const urls = useMemo(
    () => (Array.isArray(fotos360Url) ? fotos360Url.filter((u) => typeof u === 'string' && u.trim()) : []),
    [fotos360Url],
  )
  const tour = useMemo(
    () => sincronizarTourComFotos(urls, parseTourConfig(tourConfigRaw)),
    [tourConfigRaw, urls],
  )

  /** Playback simplificado: cada foto 360 é uma cena, sem setas de tour. */
  const tourPlayback = useMemo(
    () => ({
      firstScene: tour.firstScene,
      cenas: tour.cenas.map((c) => ({ ...c, hotspots: [] })),
    }),
    [tour],
  )

  const temTour = tourPlayback.cenas.length > 0
  const temVariasCenas = tourPlayback.cenas.length > 1
  const reactDomId = useId().replace(/:/g, '')
  const containerElId = `pannellum-tour-${reactDomId}`
  const viewerRef = useRef(/** @type {import('@/lib/pannellumTour').PannellumViewer | null} */ (null))
  const [fechado, setFechado] = useState(false)
  const [erro, setErro] = useState('')
  const [cenaAtivaId, setCenaAtivaId] = useState(() => getPrimeiraCena(tourPlayback)?.id ?? null)

  const mostrarFullscreen = temTour && !fechado

  const fechar = useCallback(() => {
    setFechado(true)
    onFechar?.()
  }, [onFechar])

  const reabrir = useCallback(() => {
    setFechado(false)
    setErro('')
  }, [])

  const irParaCena = useCallback((cenaId) => {
    if (!cenaId) return
    setCenaAtivaId(cenaId)
    viewerRef.current?.loadScene?.(cenaId)
    requestAnimationFrame(() => viewerRef.current?.resize?.())
  }, [])

  useEffect(() => {
    if (autoOpen && temTour) setFechado(false)
  }, [autoOpen, temTour, tourPlayback])

  useEffect(() => {
    setCenaAtivaId(getPrimeiraCena(tourPlayback)?.id ?? null)
  }, [tourPlayback])

  useEffect(() => {
    if (!mostrarFullscreen) return

    let cancelado = false

    const run = async () => {
      setErro('')
      try {
        const primeira = getPrimeiraCena(tourPlayback)
        if (primeira?.url) {
          try {
            await preloadPanorama(primeira.url)
          } catch {
            /* continua */
          }
        }
        await loadPannellumAssets()
        if (cancelado) return
        const Pannellum = getPannellum()
        const config = buildPannellumTourConfig(tourPlayback)
        if (!Pannellum || !config) {
          setErro('Visualizador 360° indisponível.')
          return
        }
        const el = document.getElementById(containerElId)
        if (!el) return
        if (viewerRef.current?.destroy) {
          try {
            viewerRef.current.destroy()
          } catch {
            /* ignore */
          }
          viewerRef.current = null
        }
        el.innerHTML = ''
        const viewer = Pannellum.viewer(containerElId, config)
        viewerRef.current = viewer
        setCenaAtivaId(primeira?.id ?? null)

        const aposCenaCarregada = () => {
          viewer.resize?.()
        }
        const onSceneChange = (sceneId) => {
          if (typeof sceneId === 'string' && sceneId) setCenaAtivaId(sceneId)
          aposCenaCarregada()
        }

        viewer.on?.('load', aposCenaCarregada)
        viewer.on?.('scenechange', onSceneChange)
        requestAnimationFrame(() => viewer.resize?.())
      } catch {
        if (!cancelado) setErro('Não foi possível carregar as fotos 360°.')
      }
    }

    void run()

    return () => {
      cancelado = true
      if (viewerRef.current?.destroy) {
        try {
          viewerRef.current.destroy()
        } catch {
          /* ignore */
        }
      }
      viewerRef.current = null
      const el = document.getElementById(containerElId)
      if (el) el.innerHTML = ''
    }
  }, [mostrarFullscreen, tourPlayback, containerElId])

  if (!urls.length) {
    return <p className="py-10 text-center text-sm text-gray-500">Nenhuma imagem 360° cadastrada</p>
  }

  if (!temTour) {
    return <p className="py-10 text-center text-sm text-gray-500">Nenhuma foto 360° disponível</p>
  }

  if (fechado) {
    return (
      <div className="px-3 py-4">
        {painelAntesIniciar}
        <div className="text-center">
          <p className="mb-3 text-sm font-medium text-[#001f3f]">Fotos 360°</p>
          <button
            type="button"
            onClick={reabrir}
            className="rounded-lg bg-[#0097b2] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95"
          >
            Abrir Fotos 360°
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="tour-player-fullscreen fixed inset-0 z-[140] flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="Fotos 360 graus"
    >
      <button
        type="button"
        onClick={fechar}
        className="absolute right-3 z-20 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
        style={{ top: 'max(2.75rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))' }}
        aria-label="Fechar"
      >
        <X className="h-6 w-6" aria-hidden />
      </button>
      {erro ? (
        <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-white">
          {erro}
        </div>
      ) : (
        <>
          <div id={containerElId} className="h-full w-full min-h-0 flex-1" />
          {temVariasCenas ? (
            <div
              className="z-20 shrink-0 border-t border-white/15 bg-black/95 pt-1"
              style={{ paddingBottom: 'max(0.35rem, env(safe-area-inset-bottom, 0px))' }}
            >
              <p className="px-3 pb-0.5 text-center text-[10px] font-medium leading-tight text-white/65">
                Toque em uma foto para navegar
              </p>
              <div
                className="flex gap-1.5 overflow-x-auto px-3 pb-1 pt-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                role="listbox"
                aria-label="Outras fotos 360"
              >
                {tourPlayback.cenas.map((cena, index) => {
                  const ativa = cena.id === cenaAtivaId
                  return (
                    <button
                      key={cena.id}
                      type="button"
                      role="option"
                      aria-selected={ativa}
                      onClick={() => irParaCena(cena.id)}
                      className={`relative h-10 w-14 shrink-0 overflow-hidden rounded-md border-2 transition ${
                        ativa
                          ? 'border-[#00D443] opacity-100'
                          : 'border-white/30 opacity-80 hover:opacity-100'
                      }`}
                      aria-label={cena.label?.trim() || `Foto 360 ${index + 1}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={cena.url} alt="" className="h-full w-full object-cover" />
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
