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
  tourTemNavegacao,
} from '@/lib/pannellumTour'

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
  const reactDomId = useId().replace(/:/g, '')
  const containerElId = `pannellum-tour-${reactDomId}`
  const viewerRef = useRef(/** @type {import('@/lib/pannellumTour').PannellumViewer | null} */ (null))
  const [fechado, setFechado] = useState(false)
  const [erro, setErro] = useState('')

  const mostrarFullscreen = temTour && !fechado

  const fechar = useCallback(() => {
    setFechado(true)
    onFechar?.()
  }, [onFechar])

  const reabrir = useCallback(() => {
    setFechado(false)
    setErro('')
  }, [])

  useEffect(() => {
    if (autoOpen && temTour) setFechado(false)
  }, [autoOpen, temTour, tour])

  useEffect(() => {
    if (!mostrarFullscreen) return

    let cancelado = false

    const run = async () => {
      setErro('')
      try {
        const primeira = getPrimeiraCena(tour)
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
        const config = buildPannellumTourConfig(tour)
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

        const aposCenaCarregada = () => {
          viewer.resize?.()
        }

        viewer.on?.('load', aposCenaCarregada)
        viewer.on?.('scenechange', aposCenaCarregada)
      } catch {
        if (!cancelado) setErro('Não foi possível carregar o tour virtual.')
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
  }, [mostrarFullscreen, tour, containerElId])

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
      {erro ? (
        <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-white">
          {erro}
        </div>
      ) : (
        <>
          <div id={containerElId} className="h-full w-full min-h-0 flex-1" />
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
