'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
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

function dimensoesMolduraMaxima(aspect: number, cw: number, ch: number) {
  if (cw <= 0 || ch <= 0) return { w: 0, h: 0 }
  if (cw / ch > aspect) {
    const h = ch
    return { w: h * aspect, h }
  }
  const w = cw
  return { w, h: w / aspect }
}

/** `object-cover`: escala uniforme e centramento no contentor cw×ch. */
function escalaCoverOffset(natW: number, natH: number, cw: number, ch: number) {
  if (natW <= 0 || natH <= 0 || cw <= 0 || ch <= 0) {
    return { s: 0, ox: 0, oy: 0 }
  }
  const s = Math.max(cw / natW, ch / natH)
  const ox = (cw - natW * s) / 2
  const oy = (ch - natH * s) / 2
  return { s, ox, oy }
}

function paraPixelCropCover(
  ux: number,
  uy: number,
  cropW: number,
  cropH: number,
  cw: number,
  ch: number,
  natW: number,
  natH: number
): PixelCrop {
  const { s, ox, oy } = escalaCoverOffset(natW, natH, cw, ch)
  if (s <= 0) {
    return { x: 0, y: 0, width: 1, height: 1 }
  }
  const x = Math.round((ux - ox) / s)
  const y = Math.round((uy - oy) / s)
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
 * Imagem em “cover” (sem faixas laterais) e moldura de recorte arrastável sobre o contentor.
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
  const [ux, setUx] = useState(0)
  const [uy, setUy] = useState(0)
  const dragRef = useRef<{ px: number; py: number; ux0: number; uy0: number } | null>(null)

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

  const { cw, ch } = box
  const ready = nat.w > 0 && nat.h > 0 && cw > 0 && ch > 0
  const { w: cropW, h: cropH } = dimensoesMolduraMaxima(aspect, cw, ch)

  useLayoutEffect(() => {
    if (!ativo || !ready || !cropW || !cropH) return
    setUx(Math.max(0, (cw - cropW) / 2))
    setUy(Math.max(0, (ch - cropH) / 2))
  }, [ativo, aspect, imageSrc, ready, cw, ch, cropW, cropH])

  useEffect(() => {
    if (!ativo || !ready || !cropW || !cropH) {
      onPixelCropChange(null)
      return
    }
    onPixelCropChange(paraPixelCropCover(ux, uy, cropW, cropH, cw, ch, nat.w, nat.h))
  }, [ativo, ux, uy, cropW, cropH, cw, ch, nat.w, nat.h, ready, onPixelCropChange])

  const onPointerDown = (e: React.PointerEvent) => {
    if (!ativo || !cropW) return
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = { px: e.clientX, py: e.clientY, ux0: ux, uy0: uy }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d || !ativo || !cropW || !cropH) return
    const dx = e.clientX - d.px
    const dy = e.clientY - d.py
    const maxX = Math.max(0, cw - cropW)
    const maxY = Math.max(0, ch - cropH)
    setUx(Math.max(0, Math.min(maxX, d.ux0 + dx)))
    setUy(Math.max(0, Math.min(maxY, d.uy0 + dy)))
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

  const showMoldura = ativo && ready && cropW > 0 && cropH > 0

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden rounded-lg bg-black ${className}`}
      style={{ touchAction: showMoldura ? 'none' : 'auto', height: 'min(52vh, 440px)' }}
    >
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element -- URL blob local */}
        <img
          src={imageSrc}
          alt=""
          draggable={false}
          onLoad={onImgLoad}
          className="pointer-events-none block h-full w-full select-none object-cover"
        />
        {showMoldura ? (
          <div
            className="absolute z-[1] cursor-grab active:cursor-grabbing"
            style={{
              left: ux,
              top: uy,
              width: cropW,
              height: cropH,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.42)',
              outline: '2px solid rgba(255,255,255,0.95)',
              outlineOffset: '-1px',
              borderRadius: '2px',
              touchAction: 'none',
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          />
        ) : null}
      </div>
    </div>
  )
}
