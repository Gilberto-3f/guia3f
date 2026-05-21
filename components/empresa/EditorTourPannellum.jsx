'use client'

import { useEffect, useId, useRef, useState } from 'react'
import {
  buildPannellumEditorConfig,
  CSS_HOTSPOT_NAVEGACAO,
  getPannellum,
  HOTSPOT_PREVIEW_ID,
  loadPannellumAssets,
  PITCH_HOTSPOT_NAVEGACAO,
  preloadPanorama,
  yawEditorParaPannellum,
  yawPannellumParaEditor,
} from '@/lib/pannellumTour'

/**
 * Editor 360° com Pannellum: setas salvas + rascunho; clique na cena posiciona a seta.
 *
 * @param {{
 *   tour: import('@/lib/tour360Types').TourConfig
 *   cenaId: string
 *   destinoDraftId: string | null
 *   destinoIdx: number | null
 *   yawEditor: number
 *   onYawChange: (yaw: number) => void
 * }} props
 */
export default function EditorTourPannellum({
  tour,
  cenaId,
  destinoDraftId,
  destinoIdx,
  yawEditor,
  onYawChange,
}) {
  const reactDomId = useId().replace(/:/g, '')
  const containerElId = `pannellum-editor-${reactDomId}`
  const viewerRef = useRef(/** @type {import('@/lib/pannellumTour').PannellumViewer | null} */ (null))
  const [viewerPronto, setViewerPronto] = useState(false)
  const onYawChangeRef = useRef(onYawChange)
  const destinoDraftIdRef = useRef(destinoDraftId)
  onYawChangeRef.current = onYawChange
  destinoDraftIdRef.current = destinoDraftId

  const cena = tour.cenas.find((c) => c.id === cenaId)

  useEffect(() => {
    if (!cena?.url || !cenaId) return

    let cancelado = false
    setViewerPronto(false)

    const run = async () => {
      try {
        await preloadPanorama(cena.url)
        await loadPannellumAssets()
        if (cancelado) return

        const config = buildPannellumEditorConfig(tour, cenaId, null)
        const Pannellum = getPannellum()
        if (!Pannellum || !config) return

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

        const yawLook = yawEditorParaPannellum(yawEditor)
        if (viewer.setYaw) viewer.setYaw(yawLook)
        if (viewer.setPitch) viewer.setPitch(PITCH_HOTSPOT_NAVEGACAO)

        const onPanoramaClick = (ev) => {
          if (!destinoDraftIdRef.current) return
          const e = ev && typeof ev === 'object' && 'clientX' in ev ? /** @type {MouseEvent} */ (ev) : null
          if (!e || !viewer.mouseEventToCoords) return
          const coords = viewer.mouseEventToCoords(e)
          if (!coords || coords.length < 2) return
          const [, yaw] = coords
          onYawChangeRef.current(yawPannellumParaEditor(yaw))
        }

        viewer.on?.('mousedown', onPanoramaClick)
        if (!cancelado) setViewerPronto(true)
      } catch {
        /* falha silenciosa — régua continua disponível */
      }
    }

    void run()

    return () => {
      cancelado = true
      setViewerPronto(false)
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
  }, [tour, cenaId, cena?.url, containerElId])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer?.setYaw) return
    viewer.setYaw(yawEditorParaPannellum(yawEditor))
  }, [yawEditor])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || !cenaId) return

    try {
      viewer.removeHotSpot?.(HOTSPOT_PREVIEW_ID, cenaId)
    } catch {
      /* ignore */
    }

    if (!destinoDraftId) return

    viewer.addHotSpot?.(
      {
        id: HOTSPOT_PREVIEW_ID,
        pitch: PITCH_HOTSPOT_NAVEGACAO,
        yaw: yawEditorParaPannellum(yawEditor),
        type: 'scene',
        text: destinoIdx != null ? `→ Ambiente ${destinoIdx}` : 'Nova seta',
        sceneId: destinoDraftId,
        cssClass: `${CSS_HOTSPOT_NAVEGACAO} tour-nav-draft`,
      },
      cenaId
    )
  }, [yawEditor, destinoDraftId, destinoIdx, cenaId, viewerPronto])

  if (!cena) return null

  return (
    <div className="w-full">
      <div
        id={containerElId}
        className="aspect-[16/9] w-full overflow-hidden rounded-lg bg-black"
        aria-label="Editor tour virtual 360 graus"
      />
      {destinoDraftId ? (
        <p className="mt-2 text-center text-[11px] text-gray-600">
          Arraste a vista e clique na foto para posicionar a seta verde (ambiente {destinoIdx ?? '?'}). Use a régua
          abaixo para ajuste fino.
        </p>
      ) : (
        <p className="mt-2 text-center text-[11px] text-gray-600">
          Toque em + NOVO, escolha o destino e posicione a seta na cena. Setas azuis são conexões já salvas (toque para
          testar).
        </p>
      )}
    </div>
  )
}
