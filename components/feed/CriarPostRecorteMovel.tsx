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

function fitContain(nw: number, nh: number, cw: number, ch: number) {
  if (nw <= 0 || nh <= 0 || cw <= 0 || ch <= 0) {
    return { dispW: 0, dispH: 0 }
  }
  const s = Math.min(cw / nw, ch / nh)
  return { dispW: nw * s, dispH: nh * s }
}

function dimensoesMolduraMaxima(aspect: number, dispW: number, dispH: number) {
  if (dispW <= 0 || dispH <= 0) return { w: 0, h: 0 }
  if (dispW / dispH > aspect) {
    const h = dispH
    return { w: h * aspect, h }
  }
  const w = dispW
  return { w, h: w / aspect }
}

function paraPixelCrop(
  ux: number,
  uy: number,
  cropW: number,
  cropH: number,
  dispW: number,
  dispH: number,
  natW: number,
  natH: number
): PixelCrop {
  const x = Math.round((ux / dispW) * natW)
  const y = Math.round((uy / dispH) * natH)
  const width = Math.round((cropW / dispW) * natW)
  const height = Math.round((cropH / dispH) * natH)
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
 * Imagem em caixa “contain” sobre fundo claro (sem barras pretas) e moldura de recorte arrastável.
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

  const ready = nat.w > 0 && nat.h > 0 && box.cw > 0 && box.ch > 0
  const { dispW, dispH } = ready ? fitContain(nat.w, nat.h, box.cw, box.ch) : { dispW: 0, dispH: 0 }
  const { w: cropW, h: cropH } = dimensoesMolduraMaxima(aspect, dispW, dispH)

  useLayoutEffect(() => {
    if (!ativo || !ready || !cropW || !cropH) return
    setUx(Math.max(0, (dispW - cropW) / 2))
    setUy(Math.max(0, (dispH - cropH) / 2))
  }, [ativo, aspect, imageSrc, ready, dispW, dispH, cropW, cropH])

  useEffect(() => {
    if (!ativo || !ready || !cropW || !cropH) {
      onPixelCropChange(null)
      return
    }
    onPixelCropChange(paraPixelCrop(ux, uy, cropW, cropH, dispW, dispH, nat.w, nat.h))
  }, [ativo, ux, uy, cropW, cropH, dispW, dispH, nat.w, nat.h, ready, onPixelCropChange])

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
    const maxX = Math.max(0, dispW - cropW)
    const maxY = Math.max(0, dispH - cropH)
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
      className={`relative w-full overflow-hidden rounded-lg bg-gray-100 ${className}`}
      style={{ touchAction: showMoldura ? 'none' : 'auto', height: 'min(52vh, 440px)' }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        {ready ? (
          <div className="relative shrink-0" style={{ width: dispW, height: dispH }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- URL blob local */}
            <img
              src={imageSrc}
              alt=""
              draggable={false}
              onLoad={onImgLoad}
              className="pointer-events-none block h-full w-full select-none object-contain"
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
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageSrc}
            alt=""
            draggable={false}
            onLoad={onImgLoad}
            className="max-h-full max-w-full select-none object-contain"
          />
        )}
      </div>
    </div>
  )
}
