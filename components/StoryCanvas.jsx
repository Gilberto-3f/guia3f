'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Link2 } from 'lucide-react'

/** @typedef {{ scale: number, pan_x_pct: number, pan_y_pct: number }} StoryFundo */

/** @param {string} src */
function isLocalMediaSrc(src) {
  const s = String(src ?? '').trim()
  return s.startsWith('/') || s.startsWith('data:')
}

/**
 * Mídia do story: URLs remotas em `<img>` (como AvatarImage) para evitar hydration mismatch do `next/image`.
 * @param {{
 *   mediaSrc: string
 *   imageObjectFit: 'cover' | 'contain'
 *   onNaturalSize?: (w: number, h: number) => void
 * }} props
 */
function StoryCanvasMedia({ mediaSrc, imageObjectFit, onNaturalSize }) {
  const fitClass = imageObjectFit === 'contain' ? 'object-contain' : 'object-cover'
  const reportSize = (/** @type {HTMLImageElement} */ img) => {
    const w = img?.naturalWidth ?? 0
    const h = img?.naturalHeight ?? 0
    if (w > 0 && h > 0) onNaturalSize?.(w, h)
  }

  if (isLocalMediaSrc(mediaSrc)) {
    return (
      <Image
        src={mediaSrc}
        alt=""
        fill
        sizes="(max-width: 768px) 100vw, 430px"
        className={`select-none ${fitClass}`}
        unoptimized
        draggable={false}
        onLoadingComplete={(img) => reportSize(img)}
      />
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={mediaSrc}
      alt=""
      className={`absolute inset-0 h-full w-full select-none ${fitClass}`}
      draggable={false}
      decoding="async"
      onLoad={(e) => reportSize(e.currentTarget)}
    />
  )
}

/** @param {number} min @param {number} v @param {number} max */
function clamp(min, v, max) {
  return Math.max(min, Math.min(max, v))
}

/**
 * Limites de pan (%) com imagem em “cover” (preenche o quadro; recorte central).
 * @param {{ areaW: number, areaH: number, imgW: number, imgH: number, scale: number }} args
 */
function panLimPctCover({ areaW, areaH, imgW, imgH, scale }) {
  if (!areaW || !areaH || !imgW || !imgH) return { limX: 0, limY: 0 }
  const cover = Math.max(areaW / imgW, areaH / imgH)
  const dispW = imgW * cover * scale
  const dispH = imgH * cover * scale
  const overX = Math.max(0, (dispW - areaW) / 2)
  const overY = Math.max(0, (dispH - areaH) / 2)
  return { limX: (overX / areaW) * 100, limY: (overY / areaH) * 100 }
}

/**
 * Limites de pan (%) com imagem em “contain” (foto inteira visível; zoom ≥1).
 * Permite deslocar quando há letterbox ou quando o zoom ultrapassa o quadro.
 * @param {{ areaW: number, areaH: number, imgW: number, imgH: number, scale: number }} args
 */
function panLimPctContain({ areaW, areaH, imgW, imgH, scale }) {
  if (!areaW || !areaH || !imgW || !imgH) return { limX: 0, limY: 0 }
  const fit = Math.min(areaW / imgW, areaH / imgH)
  const dispW = imgW * fit * scale
  const dispH = imgH * fit * scale
  const overX = Math.abs(dispW - areaW) / 2
  const overY = Math.abs(dispH - areaH) / 2
  return { limX: (overX / areaW) * 100, limY: (overY / areaH) * 100 }
}

/**
 * Limita pan para reduzir “bordas vazias” com zoom.
 * (usa a própria borda da foto como limite quando possível)
 * @param {number} scale
 * @param {number} px
 * @param {number} py
 * @param {{ areaW: number, areaH: number, imgW: number, imgH: number }} geo
 */
/**
 * @param {'cover' | 'contain'} imageObjectFit
 */
function clampFundoPan(scale, px, py, geo, imageObjectFit) {
  const limFn = imageObjectFit === 'contain' ? panLimPctContain : panLimPctCover
  const { limX, limY } = limFn({ ...geo, scale })
  return {
    pan_x_pct: clamp(-limX, px, limX),
    pan_y_pct: clamp(-limY, py, limY),
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
 *   textoScale?: number
 *   onTextoScaleChange?: (s: number) => void
 *   marcacoes?: { usuario_id: string, username: string, tipo?: string, nome?: string, foto_url?: string | null, empresa_id?: string | null, posicao_x?: number, posicao_y?: number }[]
 *   allowEditMarcacoes?: boolean
 *   onMarcacaoPos?: (usuarioId: string, p: { x: number, y: number }) => void
 *   onMarcacaoClick?: (marcacao: { usuario_id: string, username: string, tipo?: string, nome?: string, foto_url?: string | null, empresa_id?: string | null, posicao_x?: number, posicao_y?: number }, pos: { clientX: number, clientY: number }) => void
 *   onEditarLegenda?: () => void
 *   onEditarLink?: () => void
 *   linkHref?: string | null
 *   className?: string
 *   layout?: 'default' | 'editorFill' | 'viewerCover'
 *   imageObjectFit?: 'cover' | 'contain'
 *   ocultarPlaceholderLegenda?: boolean
 * }} props
 */
export default function StoryCanvas({
  mediaSrc,
  legenda,
  posicaoLegenda,
  linkUrl,
  posicaoLink,
  fundo,
  /** `contain` no editor = foto inteira + pan/zoom; `cover` = legado / viewer sem fundo_fit. */
  imageObjectFit = 'cover',
  allowEditImage = false,
  allowEditText = false,
  allowEditLink = false,
  onLegendaPos,
  onLinkPos,
  onFundoChange,
  textoScale = 1,
  onTextoScaleChange,
  marcacoes = [],
  allowEditMarcacoes = false,
  onMarcacaoPos,
  onMarcacaoClick,
  onEditarLegenda,
  onEditarLink,
  linkHref = null,
  className = '',
  layout = 'default',
  ocultarPlaceholderLegenda = false,
}) {
  const areaRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const fundoRef = useRef(fundo)
  const onFundoChangeRef = useRef(onFundoChange)
  const onTextoScaleChangeRef = useRef(onTextoScaleChange)
  const geoRef = useRef(/** @type {{ areaW: number, areaH: number, imgW: number, imgH: number }} */ ({ areaW: 0, areaH: 0, imgW: 0, imgH: 0 }))
  const legendaRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const marcacaoRefs = useRef(/** @type {Map<string, HTMLDivElement>} */ (new Map()))
  /** Medição do chip do link (âncora/span), não do wrapper posicionado. */
  const linkChipRef = useRef(/** @type {HTMLAnchorElement | HTMLSpanElement | null} */ (null))
  /** Pinch: `mode` decide se altera foto ou overlay. */
  const pinchRef = useRef(
    /** @type {{ d0: number, mode: 'fundo' | 'overlay', s0: number, px0: number, py0: number } | null} */ (null)
  )
  /** Onde pinch/rodinha aplicam: foto ou texto/link. */
  const [zoomTarget, setZoomTarget] = useState(/** @type {'fundo' | 'overlay'} */ ('fundo'))
  const zoomTargetRef = useRef(zoomTarget)
  const textoScaleRef = useRef(textoScale)
  const imageObjectFitRef = useRef(imageObjectFit)
  const dragRef = useRef(
    /** @type {null | { kind: 'img', sx: number, sy: number, fs: number, fpx: number, fpy: number } | { kind: 'text' | 'link', ox: number, oy: number } | { kind: 'marcacao', usuarioId: string, ox: number, oy: number }} */ (
      null
    )
  )
  const tapRef = useRef(/** @type {null | { kind: 'text' | 'link' | 'marcacao', x0: number, y0: number, moved: boolean }} */ (null))
  /** Viu ≥2 dedos neste gesto — evita abrir legenda após soltar o pinch. */
  const sawMultiTouchRef = useRef(false)
  /** Consome um `pointerUp` no overlay (texto/link) após pinch. */
  const skipNextOverlayEditRef = useRef(false)
  const lastTextTapForEditRef = useRef(/** @type {null | { t: number, x: number, y: number }} */ (null))
  const lastLinkTapForEditRef = useRef(/** @type {null | { t: number, x: number, y: number }} */ (null))
  const DOUBLE_TAP_MS = 420
  const DOUBLE_TAP_DIST_PX = 32

  const updateAreaGeo = useCallback(() => {
    const el = areaRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    geoRef.current = { ...geoRef.current, areaW: rect.width, areaH: rect.height }
  }, [])

  useEffect(() => {
    fundoRef.current = fundo
  }, [fundo])

  useEffect(() => {
    onFundoChangeRef.current = onFundoChange
  }, [onFundoChange])

  useEffect(() => {
    onTextoScaleChangeRef.current = onTextoScaleChange
  }, [onTextoScaleChange])

  useEffect(() => {
    zoomTargetRef.current = zoomTarget
  }, [zoomTarget])

  useEffect(() => {
    textoScaleRef.current = textoScale
  }, [textoScale])

  useEffect(() => {
    imageObjectFitRef.current = imageObjectFit
  }, [imageObjectFit])

  useEffect(() => {
    updateAreaGeo()
    const onResize = () => updateAreaGeo()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [updateAreaGeo])

  /** Pinch zoom (dois dedos) — aplica em foto ou overlay conforme `zoomTarget`. */
  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    const canFundo = Boolean(allowEditImage && onFundoChange)
    const canOverlay = Boolean(onTextoScaleChange)
    if (!canFundo && !canOverlay) return

    const dist = (/** @type {Touch} */ a, /** @type {Touch} */ b) =>
      Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY)

    const onTouchStart = (/** @type {TouchEvent} */ e) => {
      if (e.touches.length >= 2) sawMultiTouchRef.current = true
      if (e.touches.length === 2) {
        const mode = zoomTargetRef.current
        if (mode === 'fundo' && !canFundo) return
        if (mode === 'overlay' && !canOverlay) return
        const d0 = dist(e.touches[0], e.touches[1])
        const f = fundoRef.current
        const s0 = mode === 'fundo' ? f.scale : textoScaleRef.current
        pinchRef.current = { d0, mode, s0, px0: f.pan_x_pct, py0: f.pan_y_pct }
        dragRef.current = null
      }
    }

    const onTouchMove = (/** @type {TouchEvent} */ e) => {
      if (e.touches.length !== 2 || !pinchRef.current) return
      e.preventDefault()
      const d = dist(e.touches[0], e.touches[1])
      const { d0, s0, px0, py0, mode } = pinchRef.current
      if (d0 < 8) return
      const ratio = d / d0
      if (mode === 'fundo') {
        const nextScale = Math.min(3, Math.max(1, s0 * ratio))
        const c = clampFundoPan(nextScale, px0, py0, geoRef.current, imageObjectFitRef.current)
        onFundoChangeRef.current?.({ scale: nextScale, ...c })
      } else {
        const nextScale = clamp(0.5, s0 * ratio, 3)
        onTextoScaleChangeRef.current?.(nextScale)
      }
    }

    const onTouchEnd = (/** @type {TouchEvent} */ e) => {
      pinchRef.current = null
      if (e.touches.length === 0 && sawMultiTouchRef.current) {
        skipNextOverlayEditRef.current = true
        sawMultiTouchRef.current = false
      }
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
  }, [allowEditImage, onFundoChange, onTextoScaleChange])

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
      if (zoomTarget === 'overlay' && onTextoScaleChange) {
        e.preventDefault()
        const dir = e.deltaY > 0 ? -1 : 1
        const nextScale = clamp(0.5, textoScale + dir * 0.08, 3)
        onTextoScaleChange(nextScale)
        return
      }
      if (!allowEditImage || !onFundoChange) return
      e.preventDefault()
      const dir = e.deltaY > 0 ? -1 : 1
      const nextScale = Math.min(3, Math.max(1, fundo.scale + dir * 0.08))
      const c = clampFundoPan(nextScale, fundo.pan_x_pct, fundo.pan_y_pct, geoRef.current, imageObjectFit)
      onFundoChange({ scale: nextScale, ...c })
    },
    [
      zoomTarget,
      onTextoScaleChange,
      textoScale,
      allowEditImage,
      onFundoChange,
      fundo.scale,
      fundo.pan_x_pct,
      fundo.pan_y_pct,
      imageObjectFit,
    ]
  )

  const clampOverlayPct = useCallback((kind, xPct, yPct, usuarioId = '') => {
    const el = kind === 'text' ? legendaRef.current : kind === 'marcacao' ? marcacaoRefs.current.get(usuarioId) : linkChipRef.current
    const { areaW, areaH } = geoRef.current
    if (!el || !areaW || !areaH) {
      return {
        x: clamp(6, xPct, 94),
        y: clamp(8, yPct, 92),
      }
    }
    const r = el.getBoundingClientRect()
    const halfW = (r.width / 2 / areaW) * 100
    const halfH = (r.height / 2 / areaH) * 100
    const pad = 1.5
    return {
      x: clamp(halfW + pad, xPct, 100 - halfW - pad),
      y: clamp(halfH + pad, yPct, 100 - halfH - pad),
    }
  }, [])

  const pointerMove = useCallback(
    /** @param {React.PointerEvent} e */
    (e) => {
      const d = dragRef.current
      if (!d) return
      if (d.kind === 'text' && onLegendaPos) {
        const t = tapRef.current
        if (t?.kind === 'text' && !t.moved) {
          const dx = e.clientX - t.x0
          const dy = e.clientY - t.y0
          if (Math.hypot(dx, dy) > 6) tapRef.current = { ...t, moved: true }
        }
        const { x, y } = pctFromClient(e.clientX, e.clientY)
        const rawX = x - d.ox
        const rawY = y - d.oy
        const c = clampOverlayPct('text', rawX, rawY)
        onLegendaPos({ x: c.x, y: c.y })
        return
      }
      if (d.kind === 'link' && onLinkPos) {
        const t = tapRef.current
        if (t?.kind === 'link' && !t.moved) {
          const dx = e.clientX - t.x0
          const dy = e.clientY - t.y0
          if (Math.hypot(dx, dy) > 6) tapRef.current = { ...t, moved: true }
        }
        const { x, y } = pctFromClient(e.clientX, e.clientY)
        const rawX = x - d.ox
        const rawY = y - d.oy
        const c = clampOverlayPct('link', rawX, rawY)
        onLinkPos({ x: c.x, y: c.y })
        return
      }
      if (d.kind === 'marcacao' && onMarcacaoPos) {
        const t = tapRef.current
        if (t?.kind === 'marcacao' && !t.moved) {
          const dx = e.clientX - t.x0
          const dy = e.clientY - t.y0
          if (Math.hypot(dx, dy) > 6) tapRef.current = { ...t, moved: true }
        }
        const { x, y } = pctFromClient(e.clientX, e.clientY)
        const rawX = x - d.ox
        const rawY = y - d.oy
        const c = clampOverlayPct('marcacao', rawX, rawY, d.usuarioId)
        onMarcacaoPos(d.usuarioId, { x: c.x, y: c.y })
        return
      }
      if (d.kind === 'img' && onFundoChange && areaRef.current) {
        const rect = areaRef.current.getBoundingClientRect()
        const dx = ((e.clientX - d.sx) / rect.width) * 100
        const dy = ((e.clientY - d.sy) / rect.height) * 100
        const c = clampFundoPan(d.fs, d.fpx + dx, d.fpy + dy, geoRef.current, imageObjectFit)
        onFundoChange({ scale: d.fs, ...c })
      }
    },
    [onLegendaPos, onLinkPos, onMarcacaoPos, onFundoChange, pctFromClient, clampOverlayPct, imageObjectFit]
  )

  const pointerUp = useCallback(() => {
    const t = tapRef.current
    tapRef.current = null
    dragRef.current = null
    if (skipNextOverlayEditRef.current) {
      skipNextOverlayEditRef.current = false
      lastTextTapForEditRef.current = null
      lastLinkTapForEditRef.current = null
      return
    }
    const now = performance.now()
    if (t?.kind === 'text') {
      if (t.moved) {
        lastTextTapForEditRef.current = null
        return
      }
      if (typeof onEditarLegenda === 'function') {
        const prev = lastTextTapForEditRef.current
        if (
          prev &&
          now - prev.t < DOUBLE_TAP_MS &&
          Math.hypot(t.x0 - prev.x, t.y0 - prev.y) < DOUBLE_TAP_DIST_PX
        ) {
          onEditarLegenda()
          lastTextTapForEditRef.current = null
        } else {
          lastTextTapForEditRef.current = { t: now, x: t.x0, y: t.y0 }
        }
      }
      return
    }
    if (t?.kind === 'link') {
      if (t.moved) {
        lastLinkTapForEditRef.current = null
        return
      }
      if (typeof onEditarLink === 'function') {
        const prev = lastLinkTapForEditRef.current
        if (
          prev &&
          now - prev.t < DOUBLE_TAP_MS &&
          Math.hypot(t.x0 - prev.x, t.y0 - prev.y) < DOUBLE_TAP_DIST_PX
        ) {
          onEditarLink()
          lastLinkTapForEditRef.current = null
        } else {
          lastLinkTapForEditRef.current = { t: now, x: t.x0, y: t.y0 }
        }
      }
    }
  }, [onEditarLegenda, onEditarLink])

  const startMarcacao = useCallback(
    /** @param {React.PointerEvent} e @param {{ usuario_id: string, posicao_x?: number, posicao_y?: number }} marcacao */
    (e, marcacao) => {
      if (!allowEditMarcacoes || !onMarcacaoPos || !marcacao.usuario_id) return
      e.preventDefault()
      e.stopPropagation()
      setZoomTarget('overlay')
      tapRef.current = { kind: 'marcacao', x0: e.clientX, y0: e.clientY, moved: false }
      updateAreaGeo()
      const { x, y } = pctFromClient(e.clientX, e.clientY)
      const mx = typeof marcacao.posicao_x === 'number' ? marcacao.posicao_x : 50
      const my = typeof marcacao.posicao_y === 'number' ? marcacao.posicao_y : 50
      dragRef.current = { kind: 'marcacao', usuarioId: marcacao.usuario_id, ox: x - mx, oy: y - my }
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [allowEditMarcacoes, onMarcacaoPos, pctFromClient, updateAreaGeo]
  )

  const startText = useCallback(
    /** @param {React.PointerEvent} e */
    (e) => {
      if (!allowEditText || !onLegendaPos) return
      e.preventDefault()
      e.stopPropagation()
      setZoomTarget('overlay')
      tapRef.current = { kind: 'text', x0: e.clientX, y0: e.clientY, moved: false }
      updateAreaGeo()
      const { x, y } = pctFromClient(e.clientX, e.clientY)
      dragRef.current = { kind: 'text', ox: x - posicaoLegenda.x, oy: y - posicaoLegenda.y }
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [allowEditText, onLegendaPos, pctFromClient, posicaoLegenda.x, posicaoLegenda.y, updateAreaGeo]
  )

  const startLink = useCallback(
    /** @param {React.PointerEvent} e */
    (e) => {
      if (!allowEditLink || !onLinkPos) return
      e.preventDefault()
      e.stopPropagation()
      setZoomTarget('overlay')
      tapRef.current = { kind: 'link', x0: e.clientX, y0: e.clientY, moved: false }
      updateAreaGeo()
      const { x, y } = pctFromClient(e.clientX, e.clientY)
      dragRef.current = { kind: 'link', ox: x - posicaoLink.x, oy: y - posicaoLink.y }
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [allowEditLink, onLinkPos, pctFromClient, posicaoLink.x, posicaoLink.y, updateAreaGeo]
  )

  const startImg = useCallback(
    /** @param {React.PointerEvent} e */
    (e) => {
      if (!allowEditImage || !onFundoChange) return
      e.preventDefault()
      setZoomTarget('fundo')
      updateAreaGeo()
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
    [allowEditImage, onFundoChange, fundo.scale, fundo.pan_x_pct, fundo.pan_y_pct, updateAreaGeo]
  )

  const textoSombreado = { textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 2px 14px rgba(0,0,0,0.55)' }

  const boxClass =
    layout === 'viewerCover'
      ? 'relative h-full w-full overflow-hidden bg-black'
      : layout === 'editorFill'
        ? 'relative mx-auto aspect-[9/16] h-[min(calc(100dvh-5.75rem),calc(100vw*16/9))] w-auto max-w-full overflow-hidden bg-black touch-none'
        : 'relative aspect-[9/16] w-full max-w-[min(100vw-1rem,calc((100dvh-11rem)*9/16))] overflow-hidden bg-black touch-none'

  return (
    <div
      ref={areaRef}
      className={`${boxClass} ${className}`}
      onWheel={onWheel}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={pointerUp}
    >
      <div
        className={`absolute inset-0 z-0 ${allowEditImage ? 'cursor-grab active:cursor-grabbing' : ''}`}
        onPointerDown={startImg}
        style={allowEditImage ? { touchAction: 'none' } : undefined}
        role={allowEditImage ? 'application' : undefined}
        aria-label={
          allowEditImage
            ? 'Arraste para mover em qualquer direção; rodinha para zoom; dois dedos para ampliar'
            : undefined
        }
      >
        <div
          className="absolute inset-0 will-change-transform"
          style={{
            transform: `translate(${fundo.pan_x_pct}%, ${fundo.pan_y_pct}%) scale(${fundo.scale})`,
            transformOrigin: 'center center',
          }}
        >
          <StoryCanvasMedia
            mediaSrc={mediaSrc}
            imageObjectFit={imageObjectFit}
            onNaturalSize={(w, h) => {
              geoRef.current = { ...geoRef.current, imgW: w, imgH: h }
            }}
          />
        </div>
      </div>

      {legenda ? (
        <div
          ref={legendaRef}
          role="textbox"
          aria-label="Legenda no story"
          className={`absolute z-10 inline-block w-auto max-w-[88%] min-w-[3.5rem] cursor-default select-none rounded px-2 py-1 text-center text-base font-semibold text-white whitespace-pre-wrap break-words sm:text-lg ${
            allowEditText ? 'cursor-move touch-none' : ''
          }`}
          style={{
            left: `${posicaoLegenda.x}%`,
            top: `${posicaoLegenda.y}%`,
            transform: `translate(-50%, -50%) scale(${textoScale})`,
            textShadow: textoSombreado.textShadow,
          }}
          onPointerDown={startText}
          onDoubleClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (allowEditText && onEditarLegenda) onEditarLegenda()
          }}
        >
          {legenda}
        </div>
      ) : allowEditText && !ocultarPlaceholderLegenda ? (
        <div
          ref={legendaRef}
          role="presentation"
          className="absolute z-10 inline-block w-auto max-w-[88%] min-w-[3.5rem] cursor-move touch-none rounded bg-black/35 px-2 py-1 text-center text-sm italic text-white/90"
          style={{
            left: `${posicaoLegenda.x}%`,
            top: `${posicaoLegenda.y}%`,
            transform: `translate(-50%, -50%) scale(${textoScale})`,
          }}
          onPointerDown={startText}
          onDoubleClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (allowEditText && onEditarLegenda) onEditarLegenda()
          }}
        >
          Adicione uma legenda…
        </div>
      ) : null}

      {linkUrl ? (
        <div
          className={`absolute z-10 max-w-[min(90%,calc(100%-1.5rem))] ${allowEditLink ? 'cursor-move touch-none' : ''}`}
          style={{
            left: `${posicaoLink.x}%`,
            top: `${posicaoLink.y}%`,
            transform: `translate(-50%, -50%) scale(${textoScale})`,
          }}
          onPointerDown={startLink}
          onDoubleClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (allowEditLink && onEditarLink) onEditarLink()
          }}
        >
          {linkHref ? (
            <a
              ref={linkChipRef}
              href={linkHref}
              target="_blank"
              rel="external noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm"
              onClick={(ev) => {
                if (allowEditLink) ev.preventDefault()
                else {
                  ev.preventDefault()
                  // Melhor esforço: abrir em contexto externo (no PWA pode variar por SO/navegador).
                  window.open(linkHref, '_blank', 'noopener,noreferrer')
                }
              }}
            >
              <Link2 size={18} strokeWidth={2} aria-hidden className="text-gray-700" />
              Saiba mais
            </a>
          ) : (
            <span
              ref={linkChipRef}
              className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm"
            >
              <Link2 size={18} strokeWidth={2} aria-hidden className="text-gray-700" />
              Saiba mais
            </span>
          )}
        </div>
      ) : null}

      {marcacoes.map((m, index) => {
        const usuarioId = String(m.usuario_id ?? '')
        const username = String(m.username ?? '').replace(/^@+/, '').trim()
        if (!usuarioId || !username) return null
        const x = typeof m.posicao_x === 'number' ? m.posicao_x : clamp(12, 50 + index * 4, 88)
        const y = typeof m.posicao_y === 'number' ? m.posicao_y : clamp(14, 58 + index * 5, 88)
        return (
          <div
            key={usuarioId}
            ref={(el) => {
              if (el) marcacaoRefs.current.set(usuarioId, el)
              else marcacaoRefs.current.delete(usuarioId)
            }}
            role="text"
            aria-label={`Marcação @${username}`}
            className={`absolute inline-block max-w-[88%] select-none rounded bg-black/35 px-2 py-1 text-center text-base font-semibold text-white sm:text-lg ${
              onMarcacaoClick && !allowEditMarcacoes ? 'z-[18] cursor-pointer' : 'z-10'
            } ${allowEditMarcacoes ? 'cursor-move touch-none' : ''
            }`}
            style={{
              left: `${x}%`,
              top: `${y}%`,
              transform: `translate(-50%, -50%) scale(${textoScale})`,
              textShadow: textoSombreado.textShadow,
            }}
            onPointerDown={(e) => {
              if (allowEditMarcacoes) startMarcacao(e, m)
              else if (onMarcacaoClick) e.stopPropagation()
            }}
            onClick={(e) => {
              if (!onMarcacaoClick || allowEditMarcacoes) return
              e.preventDefault()
              e.stopPropagation()
              onMarcacaoClick(m, { clientX: e.clientX, clientY: e.clientY })
            }}
          >
            @{username}
          </div>
        )
      })}
    </div>
  )
}

