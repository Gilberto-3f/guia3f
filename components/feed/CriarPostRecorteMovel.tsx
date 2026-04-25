'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PixelCrop } from '@/lib/cropImage'

type Props = {
  imageSrc: string
  /** largura do recorte / altura do recorte */
  aspect: number
  /** Quando falso, só mostra a imagem (sem moldura). */
  ativo: boolean
  className?: string
  onPixelCropChange: (crop: PixelCrop | null) => void
}

const ZOOM_MIN = 1
const ZOOM_MAX = 4

function dimensoesMolduraMaxima(aspect: number, cw: number, ch: number) {
  if (cw <= 0 || ch <= 0) return { w: 0, h: 0 }
  if (cw / ch > aspect) {
    const h = ch
    return { w: h * aspect, h }
  }
  const w = cw
  return { w, h: w / aspect }
}

/** Escala base “cover” no contentor (igual a `object-cover` em cw×ch). */
function escalaCover(natW: number, natH: number, cw: number, ch: number) {
  if (natW <= 0 || natH <= 0 || cw <= 0 || ch <= 0) return 0
  return Math.max(cw / natW, ch / natH)
}

function clampPan(
  panX: number,
  panY: number,
  natW: number,
  natH: number,
  cw: number,
  ch: number,
  cropW: number,
  cropH: number,
  zoom: number
): { panX: number; panY: number } {
  const s0 = escalaCover(natW, natH, cw, ch)
  if (s0 <= 0 || !cropW || !cropH) return { panX: 0, panY: 0 }
  const s = s0 * zoom
  const Wd = natW * s
  const Hd = natH * s
  const ux = (cw - cropW) / 2
  const uy = (ch - cropH) / 2
  const minPanX = ux + cropW - cw / 2 - Wd / 2
  const maxPanX = ux - (cw - Wd) / 2
  const minPanY = uy + cropH - ch / 2 - Hd / 2
  const maxPanY = uy - (ch - Hd) / 2
  return {
    panX: Math.min(maxPanX, Math.max(minPanX, panX)),
    panY: Math.min(maxPanY, Math.max(minPanY, panY)),
  }
}

function paraPixelCropPanZoom(
  natW: number,
  natH: number,
  cw: number,
  ch: number,
  cropW: number,
  cropH: number,
  zoom: number,
  panX: number,
  panY: number
): PixelCrop {
  const s0 = escalaCover(natW, natH, cw, ch)
  if (s0 <= 0 || !cropW || !cropH) {
    return { x: 0, y: 0, width: 1, height: 1 }
  }
  const s = s0 * zoom
  const Wd = natW * s
  const Hd = natH * s
  const ux = (cw - cropW) / 2
  const uy = (ch - cropH) / 2
  const imgLeft = (cw - Wd) / 2 + panX
  const imgTop = (ch - Hd) / 2 + panY
  const x = Math.round((ux - imgLeft) / s)
  const y = Math.round((uy - imgTop) / s)
  const width = Math.round(cropW / s)
  const height = Math.round(cropH / s)
  const w = Math.max(1, Math.min(width, natW - Math.max(0, x)))
  const h = Math.max(1, Math.min(height, natH - Math.max(0, y)))
  return {
    x: Math.max(0, Math.min(x, natW - w)),
    y: Math.max(0, Math.min(y, natH - h)),
    width: w,
    height: h,
  }
}

/**
 * Recorte com proporção fixa (moldura centrada), imagem com pan e zoom (rodinha / pinch).
 */
export default function CriarPostRecorteMovel({
  imageSrc,
  aspect,
  ativo,
  className = '',
  onPixelCropChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [nat, setNat] = useState({ w: 0, h: 0 })
  const [box, setBox] = useState({ cw: 0, ch: 0 })
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ px: number; py: number; pan0: { x: number; y: number } } | null>(null)
  const pinchRef = useRef<{ dist0: number; zoom0: number } | null>(null)
  const zoomRef = useRef(1)

  const medir = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setBox({ cw: Math.max(1, r.width), ch: Math.max(1, r.height) })
  }, [])

  useLayoutEffect(() => {
    medir()
  }, [medir, imageSrc])

  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => medir())
    ro.observe(el)
    return () => ro.disconnect()
  }, [medir])

  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  const { cw, ch } = box
  const ready = nat.w > 0 && nat.h > 0 && cw > 0 && ch > 0
  const { w: cropW, h: cropH } = dimensoesMolduraMaxima(aspect, cw, ch)
  const showMoldura = ativo && ready && cropW > 0 && cropH > 0

  const panClamped = useMemo(() => {
    if (!ativo || !ready || !cropW || !cropH) {
      return { x: pan.x, y: pan.y }
    }
    const c = clampPan(pan.x, pan.y, nat.w, nat.h, cw, ch, cropW, cropH, zoom)
    return { x: c.panX, y: c.panY }
  }, [pan.x, pan.y, ativo, ready, cropW, cropH, nat.w, nat.h, cw, ch, zoom])

  useEffect(() => {
    if (!ativo || !ready || !cropW || !cropH) {
      onPixelCropChange(null)
      return
    }
    onPixelCropChange(
      paraPixelCropPanZoom(nat.w, nat.h, cw, ch, cropW, cropH, zoom, panClamped.x, panClamped.y)
    )
  }, [
    ativo,
    ready,
    cropW,
    cropH,
    cw,
    ch,
    nat.w,
    nat.h,
    zoom,
    panClamped.x,
    panClamped.y,
    onPixelCropChange,
  ])

  useEffect(() => {
    const el = containerRef.current
    if (!el || !showMoldura) return
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault()
      const factor = 1 + (-ev.deltaY) * 0.0012
      const nz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoomRef.current * factor))
      setZoom(nz)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [showMoldura])

  useEffect(() => {
    const el = containerRef.current
    if (!el || !showMoldura) return
    const dist = (t: TouchList) => {
      if (t.length < 2) return 0
      const dx = t[0].clientX - t[1].clientX
      const dy = t[0].clientY - t[1].clientY
      return Math.hypot(dx, dy)
    }
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchRef.current = { dist0: dist(e.touches), zoom0: zoomRef.current }
      }
    }
    const onTouchMove = (e: TouchEvent) => {
      const p = pinchRef.current
      if (!p || e.touches.length !== 2 || p.dist0 <= 0) return
      e.preventDefault()
      const d = dist(e.touches)
      if (d <= 0) return
      const ratio = d / p.dist0
      const nz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, p.zoom0 * ratio))
      setZoom(nz)
    }
    const onTouchEnd = () => {
      pinchRef.current = null
    }
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [showMoldura])

  const onPointerDown = (e: React.PointerEvent) => {
    if (!ativo || !cropW) return
    if (e.pointerType === 'touch' && typeof e.isPrimary === 'boolean' && !e.isPrimary) return
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = { px: e.clientX, py: e.clientY, pan0: { x: panClamped.x, y: panClamped.y } }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d || !ativo || !cropW || !cropH) return
    const dx = e.clientX - d.px
    const dy = e.clientY - d.py
    const next = clampPan(d.pan0.x + dx, d.pan0.y + dy, nat.w, nat.h, cw, ch, cropW, cropH, zoom)
    setPan({ x: next.panX, y: next.panY })
  }

  const endDrag = (e: React.PointerEvent) => {
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* noop */
    }
    dragRef.current = null
  }

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const im = e.currentTarget
    setNat({ w: im.naturalWidth, h: im.naturalHeight })
  }

  const s0 = ready ? escalaCover(nat.w, nat.h, cw, ch) : 0
  const s = s0 * zoom
  const Wd = nat.w * s
  const Hd = nat.h * s
  const imgLeft = (cw - Wd) / 2 + panClamped.x
  const imgTop = (ch - Hd) / 2 + panClamped.y
  const ux = (cw - cropW) / 2
  const uy = (ch - cropH) / 2

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden rounded-lg bg-black ${className}`}
      style={{ touchAction: showMoldura ? 'none' : 'auto', height: 'min(52vh, 440px)' }}
      role="presentation"
      aria-label={showMoldura ? 'Arraste para posicionar; rodinha ou pinça para zoom' : undefined}
    >
      <div className="absolute inset-0">
        {showMoldura ? (
            <>
            <div
              className="absolute z-0 cursor-grab touch-none active:cursor-grabbing"
              style={{
                left: imgLeft,
                top: imgTop,
                width: Wd,
                height: Hd,
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- URL blob; next/image não cobre blob local */}
              <img
                src={imageSrc}
                alt=""
                draggable={false}
                onLoad={onImgLoad}
                className="pointer-events-none block h-full w-full select-none object-fill"
              />
            </div>
            <div className="pointer-events-none absolute inset-0 z-[1]">
              <div className="absolute left-0 right-0 top-0 bg-black/42" style={{ height: uy }} />
              <div
                className="absolute left-0 right-0 bg-black/42"
                style={{ top: uy + cropH, bottom: 0 }}
              />
              <div
                className="absolute bg-black/42"
                style={{ left: 0, top: uy, width: ux, height: cropH }}
              />
              <div
                className="absolute bg-black/42"
                style={{ left: ux + cropW, top: uy, right: 0, height: cropH }}
              />
              <div
                className="absolute rounded-sm border-2 border-white/95 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.15)]"
                style={{ left: ux, top: uy, width: cropW, height: cropH }}
              />
            </div>
          </>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- URL blob local
          <img
            src={imageSrc}
            alt=""
            draggable={false}
            onLoad={onImgLoad}
            className="pointer-events-none block h-full w-full select-none object-cover"
          />
        )}
      </div>
    </div>
  )
}
