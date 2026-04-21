'use client'

import { useCallback, useRef } from 'react'
import Image from 'next/image'

/** @typedef {{ scale: number, pan_x_pct: number, pan_y_pct: number }} StoryFundo */

/**
 * Limita pan para reduzir “bordas vazias” com zoom.
 * @param {number} scale
 * @param {number} px
 * @param {number} py
 */
function clampFundoPan(scale, px, py) {
  const lim = Math.min(48, Math.max(0, (scale - 1) * 28))
  return {
    pan_x_pct: Math.max(-lim, Math.min(lim, px)),
    pan_y_pct: Math.max(-lim, Math.min(lim, py)),
  }
}

/**
 * Canvas 9:16 (proporção 1080×1920). Foto numa camada com zoom/pan; texto e link em overlays.
 * @param {{
 *   mediaSrc: string
 *   legenda: string
 *   posicaoLegenda: { x: number, y: number }
 *   linkUrl: string
 *   posicaoLink: { x: number, y: number }
 *   fundo: StoryFundo
 *   allowEditImage?: boolean
 *   allowEditText?: boolean
 *   allowEditLink?: boolean
 *   onLegendaPos?: (p: { x: number, y: number }) => void
 *   onLinkPos?: (p: { x: number, y: number }) => void
 *   onFundoChange?: (f: StoryFundo) => void
 *   linkHref?: string | null
 *   className?: string
 * }} props
 */
export default function StoryCanvas({
  mediaSrc,
  legenda,
  posicaoLegenda,
  linkUrl,
  posicaoLink,
  fundo,
  allowEditImage = false,
  allowEditText = false,
  allowEditLink = false,
  onLegendaPos,
  onLinkPos,
  onFundoChange,
  linkHref = null,
  className = '',
}) {
  const areaRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const dragRef = useRef(
    /** @type {null | { kind: 'img', sx: number, sy: number, fs: number, fpx: number, fpy: number } | { kind: 'text' | 'link', ox: number, oy: number }} */ (
      null
    )
  )

  const pctFromClient = useCallback((clientX, clientY) => {
    const el = areaRef.current
    if (!el) return { x: 50, y: 50 }
    const rect = el.getBoundingClientRect()
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100))
    return { x, y }
  }, [])

  const onWheel = useCallback(
    /** @param {React.WheelEvent} e */
    (e) => {
      if (!allowEditImage || !onFundoChange) return
      e.preventDefault()
      const dir = e.deltaY > 0 ? -1 : 1
      const nextScale = Math.min(3, Math.max(1, fundo.scale + dir * 0.08))
      const c = clampFundoPan(nextScale, fundo.pan_x_pct, fundo.pan_y_pct)
      onFundoChange({ scale: nextScale, ...c })
    },
    [allowEditImage, onFundoChange, fundo.scale, fundo.pan_x_pct, fundo.pan_y_pct]
  )

  const pointerMove = useCallback(
    /** @param {React.PointerEvent} e */
    (e) => {
      const d = dragRef.current
      if (!d) return
      if (d.kind === 'text' && onLegendaPos) {
        const { x, y } = pctFromClient(e.clientX, e.clientY)
        const nx = Math.max(6, Math.min(94, x - d.ox))
        const ny = Math.max(8, Math.min(92, y - d.oy))
        onLegendaPos({ x: nx, y: ny })
        return
      }
      if (d.kind === 'link' && onLinkPos) {
        const { x, y } = pctFromClient(e.clientX, e.clientY)
        const nx = Math.max(10, Math.min(90, x - d.ox))
        const ny = Math.max(12, Math.min(90, y - d.oy))
        onLinkPos({ x: nx, y: ny })
        return
      }
      if (d.kind === 'img' && onFundoChange && areaRef.current) {
        const rect = areaRef.current.getBoundingClientRect()
        const dx = ((e.clientX - d.sx) / rect.width) * 100
        const dy = ((e.clientY - d.sy) / rect.height) * 100
        const c = clampFundoPan(d.fs, d.fpx + dx, d.fpy + dy)
        onFundoChange({ scale: d.fs, ...c })
      }
    },
    [onLegendaPos, onLinkPos, onFundoChange, pctFromClient]
  )

  const pointerUp = useCallback(() => {
    dragRef.current = null
  }, [])

  const startText = useCallback(
    /** @param {React.PointerEvent} e */
    (e) => {
      if (!allowEditText || !onLegendaPos) return
      e.preventDefault()
      e.stopPropagation()
      const { x, y } = pctFromClient(e.clientX, e.clientY)
      dragRef.current = { kind: 'text', ox: x - posicaoLegenda.x, oy: y - posicaoLegenda.y }
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [allowEditText, onLegendaPos, pctFromClient, posicaoLegenda.x, posicaoLegenda.y]
  )

  const startLink = useCallback(
    /** @param {React.PointerEvent} e */
    (e) => {
      if (!allowEditLink || !onLinkPos) return
      e.preventDefault()
      e.stopPropagation()
      const { x, y } = pctFromClient(e.clientX, e.clientY)
      dragRef.current = { kind: 'link', ox: x - posicaoLink.x, oy: y - posicaoLink.y }
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [allowEditLink, onLinkPos, pctFromClient, posicaoLink.x, posicaoLink.y]
  )

  const startImg = useCallback(
    /** @param {React.PointerEvent} e */
    (e) => {
      if (!allowEditImage || !onFundoChange) return
      e.preventDefault()
      dragRef.current = {
        kind: 'img',
        sx: e.clientX,
        sy: e.clientY,
        lx: 0,
        ly: 0,
        px: 0,
        py: 0,
        fs: fundo.scale,
        fpx: fundo.pan_x_pct,
        fpy: fundo.pan_y_pct,
      }
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [allowEditImage, onFundoChange, fundo.scale, fundo.pan_x_pct, fundo.pan_y_pct]
  )

  const textoSombreado = { textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 2px 14px rgba(0,0,0,0.55)' }

  return (
    <div
      ref={areaRef}
      className={`relative aspect-[9/16] w-full max-w-[min(100vw-1rem,calc((100dvh-11rem)*9/16))] overflow-hidden bg-black touch-none ${className}`}
      onWheel={onWheel}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={pointerUp}
    >
      <div
        className={`absolute inset-0 z-0 ${allowEditImage ? 'cursor-grab active:cursor-grabbing' : ''}`}
        onPointerDown={startImg}
        role={allowEditImage ? 'application' : undefined}
        aria-label={allowEditImage ? 'Arraste para reposicionar; role para zoom' : undefined}
      >
        <div
          className="absolute inset-0 will-change-transform"
          style={{
            transform: `translate(${fundo.pan_x_pct}%, ${fundo.pan_y_pct}%) scale(${fundo.scale})`,
            transformOrigin: 'center center',
          }}
        >
          <Image src={mediaSrc} alt="" fill sizes="(max-width: 768px) 100vw, 430px" className="object-cover select-none" unoptimized draggable={false} />
        </div>
      </div>

      {legenda ? (
        <div
          role="textbox"
          aria-label="Legenda no story"
          className={`absolute z-10 max-w-[88%] cursor-default select-none rounded px-2 py-1 text-center text-base font-semibold text-white sm:text-lg ${
            allowEditText ? 'cursor-move touch-none' : ''
          }`}
          style={{
            left: `${posicaoLegenda.x}%`,
            top: `${posicaoLegenda.y}%`,
            transform: 'translate(-50%, -50%)',
            textShadow: textoSombreado.textShadow,
          }}
          onPointerDown={startText}
        >
          {legenda}
        </div>
      ) : allowEditText ? (
        <div
          role="presentation"
          className="absolute z-10 max-w-[88%] cursor-move touch-none rounded bg-black/35 px-2 py-1 text-center text-sm italic text-white/90"
          style={{
            left: `${posicaoLegenda.x}%`,
            top: `${posicaoLegenda.y}%`,
            transform: 'translate(-50%, -50%)',
          }}
          onPointerDown={startText}
        >
          Adicione uma legenda…
        </div>
      ) : null}

      {linkUrl ? (
        <div
          className={`absolute z-10 max-w-[90%] ${allowEditLink ? 'cursor-move touch-none' : ''}`}
          style={{
            left: `${posicaoLink.x}%`,
            top: `${posicaoLink.y}%`,
            transform: 'translate(-50%, -50%)',
          }}
          onPointerDown={startLink}
        >
          {linkHref ? (
            <a
              href={linkHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#0097b2] px-4 py-2 text-sm font-semibold text-white shadow-lg"
              onClick={(ev) => {
                if (allowEditLink) ev.preventDefault()
              }}
            >
              🔗 Saiba mais
            </a>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0097b2] px-4 py-2 text-sm font-semibold text-white shadow-lg">
              🔗 Saiba mais
            </span>
          )}
        </div>
      ) : null}
    </div>
  )
}

