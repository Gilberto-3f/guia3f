'use client'

import { useEffect, useRef } from 'react'
import { Pannellum } from 'pannellum-react'

/**
 * Viewer 360° (pannellum-react) com hotspots de navegação entre cenas.
 *
 * @param {{
 *   cena: import('@/lib/tour360Types').CenaTour360
 *   hotspots: import('@/lib/tour360Types').HotspotTour360[]
 *   onNavigate: (sceneId: string) => void
 *   onLoad?: () => void
 *   onError?: () => void
 *   viewerRef?: import('react').RefObject<import('pannellum-react').Pannellum | null>
 * }} props
 */
export default function TourPannellumView({ cena, hotspots, onNavigate, onLoad, onError, viewerRef }) {
  const innerRef = useRef(/** @type {import('pannellum-react').Pannellum | null} */ (null))

  useEffect(() => {
    if (!viewerRef) return
    viewerRef.current = innerRef.current
    return () => {
      if (viewerRef) viewerRef.current = null
    }
  }, [viewerRef, cena.id])

  useEffect(() => {
    const t = requestAnimationFrame(() => {
      innerRef.current?.forceRender?.()
    })
    return () => cancelAnimationFrame(t)
  }, [cena.id, cena.url, hotspots])

  const view = cena.view ?? {}
  const temViewSalva =
    typeof view.pitch === 'number' || typeof view.yaw === 'number' || typeof view.hfov === 'number'
  const primeiroHs = hotspots[0]
  const pitch =
    typeof view.pitch === 'number' ? view.pitch : !temViewSalva && primeiroHs ? primeiroHs.pitch : 0
  const yaw = typeof view.yaw === 'number' ? view.yaw : !temViewSalva && primeiroHs ? primeiroHs.yaw : 0
  const hfov = typeof view.hfov === 'number' ? view.hfov : 100

  return (
    <Pannellum
      ref={innerRef}
      width="100%"
      height="100%"
      image={cena.url}
      pitch={pitch}
      yaw={yaw}
      hfov={hfov}
      minHfov={50}
      maxHfov={120}
      autoLoad
      autoRotate={0}
      showZoomCtrl
      showFullscreenCtrl={false}
      compass={false}
      onLoad={onLoad}
      onError={onError}
    >
      {hotspots.map((h) => (
        <Pannellum.Hotspot
          key={h.id}
          type="custom"
          pitch={h.pitch}
          yaw={h.yaw}
          cssClass="tour-nav-hotspot"
          tooltip={(div) => {
            div.innerHTML = ''
          }}
          handleClick={() => onNavigate(h.sceneId)}
        />
      ))}
    </Pannellum>
  )
}
