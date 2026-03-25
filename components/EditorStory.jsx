'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Link as LinkIcon } from 'lucide-react'

/**
 * @param {{
 *   mediaSrc: string
 *   mediaKind: 'image' | 'video'
 *   legenda: string
 *   onLegendaChange: (s: string) => void
 *   posicao: { x: number, y: number }
 *   onPosicaoChange: (p: { x: number, y: number }) => void
 *   linkUrl: string
 *   onLinkChange: (s: string) => void
 *   onPreview: () => void
 * }} props
 */
export default function EditorStory({ mediaSrc, mediaKind, legenda, onLegendaChange, posicao, onPosicaoChange, linkUrl, onLinkChange, onPreview }) {
  const [arrastando, setArrastando] = useState(false)
  const areaRef = useRef(/** @type {HTMLDivElement | null} */ (null))

  /**
   * @param {React.MouseEvent | React.TouchEvent} e
   */
  const inicioArraste = (e) => {
    e.preventDefault()
    setArrastando(true)
  }

  /**
   * @param {React.MouseEvent | React.TouchEvent} e
   */
  const fimArraste = () => {
    setArrastando(false)
  }

  /**
   * @param {React.MouseEvent | React.TouchEvent} e
   */
  const mover = (e) => {
    if (!arrastando || !areaRef.current) return
    const rect = areaRef.current.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0]?.clientX ?? 0 : e.clientX
    const clientY = 'touches' in e ? e.touches[0]?.clientY ?? 0 : e.clientY
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100))
    onPosicaoChange({ x, y })
  }

  return (
    <div className="space-y-4">
      <div
        ref={areaRef}
        className="relative mx-auto aspect-[9/16] max-h-[60vh] w-full max-w-sm overflow-hidden rounded-xl bg-black select-none"
        onMouseMove={mover}
        onMouseUp={fimArraste}
        onMouseLeave={fimArraste}
        onTouchMove={mover}
        onTouchEnd={fimArraste}
      >
        {mediaKind === 'video' ? (
          <video src={mediaSrc} className="absolute inset-0 h-full w-full object-cover" muted playsInline loop preload="metadata" />
        ) : (
          <Image src={mediaSrc} alt="" fill className="object-cover" unoptimized />
        )}
        <div
          role="textbox"
          aria-label="Legenda arrastável"
          className="absolute max-w-[90%] cursor-grab rounded bg-black/40 px-2 py-1 text-sm font-medium text-white active:cursor-grabbing"
          style={{ left: `${posicao.x}%`, top: `${posicao.y}%`, transform: 'translate(-50%, -50%)' }}
          onMouseDown={inicioArraste}
          onTouchStart={inicioArraste}
        >
          {legenda || 'Toque e arraste — edite abaixo'}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-500">Legenda (máx. 150)</label>
        <textarea
          value={legenda}
          maxLength={150}
          onChange={(e) => onLegendaChange(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-200 p-2 text-sm"
          placeholder="Escreva algo..."
        />
      </div>

      <div>
        <label className="mb-1 flex items-center gap-1 text-xs text-gray-500">
          <LinkIcon size={14} aria-hidden />
          Link opcional
        </label>
        <input
          type="url"
          value={linkUrl}
          onChange={(e) => onLinkChange(e.target.value)}
          placeholder="https://"
          className="w-full rounded-lg border border-gray-200 p-2 text-sm"
        />
      </div>

      <button type="button" onClick={onPreview} className="w-full rounded-lg bg-[#0097b2] py-3 font-medium text-white">
        Prévia
      </button>
    </div>
  )
}
