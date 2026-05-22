'use client'

import { useCallback, useRef, useState } from 'react'
import {
  EDITOR_PANORAMA_BG_ALTURA_PERCENT,
  yawGrausParaPosicaoPercent,
} from '@/lib/pannellumTour'

/**
 * Faixa da foto 360° + pino fixo + arraste horizontal (sem Pannellum).
 *
 * @param {{
 *   panoramaUrl: string
 *   yawGraus: number
 *   onYawChange: (yaw: number) => void
 *   numeroDestino: number | null
 *   destinoConectado?: boolean
 * }} props
 */
export default function EditorTourViewport({
  panoramaUrl,
  yawGraus,
  onYawChange,
  numeroDestino,
  destinoConectado = false,
}) {
  const areaRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const arrasteRef = useRef(/** @type {{ startX: number; startYaw: number } | null} */ (null))
  const [arrastando, setArrastando] = useState(false)

  const bgPosX = yawGrausParaPosicaoPercent(yawGraus)

  const normalizarYaw = (graus) => {
    const n = graus % 360
    return n < 0 ? n + 360 : n
  }

  const aplicarDeltaPx = useCallback(
    (deltaX) => {
      const el = areaRef.current
      if (!el || !arrasteRef.current) return
      const largura = el.clientWidth || 1
      const grausPorPx = 360 / largura
      const novo = normalizarYaw(arrasteRef.current.startYaw + deltaX * grausPorPx)
      onYawChange(novo)
    },
    [onYawChange]
  )

  const onPointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    arrasteRef.current = { startX: e.clientX, startYaw: yawGraus }
    setArrastando(true)
    e.currentTarget.setPointerCapture(e.pointerId)
    e.preventDefault()
  }

  const onPointerMove = (e) => {
    if (!arrasteRef.current) return
    aplicarDeltaPx(e.clientX - arrasteRef.current.startX)
  }

  const onPointerUp = (e) => {
    if (!arrasteRef.current) return
    arrasteRef.current = null
    setArrastando(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="w-full">
      <div
        ref={areaRef}
        className="relative aspect-[16/9] w-full touch-none overflow-hidden rounded-lg bg-black select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="presentation"
        aria-label="Arraste para a esquerda ou direita para posicionar a seta"
      >
        <div
          className={`absolute inset-0 ${arrastando ? '' : 'transition-[background-position] duration-150 ease-out'}`}
          style={{
            backgroundImage: `url(${panoramaUrl})`,
            backgroundSize: `auto ${EDITOR_PANORAMA_BG_ALTURA_PERCENT}%`,
            backgroundPosition: `${bgPosX}% 50%`,
            backgroundRepeat: 'no-repeat',
          }}
          role="img"
          aria-hidden
        />

        <div
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
          aria-hidden
        >
          <div className="flex flex-col items-center drop-shadow-md">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white ring-2 ring-white/90 ${
                destinoConectado ? 'bg-[#00D443]' : 'bg-[#0097b2]'
              }`}
            >
              {numeroDestino != null ? numeroDestino : '?'}
            </div>
            <div
              className={`-mt-px h-0 w-0 border-x-[6px] border-t-[9px] border-x-transparent ${
                destinoConectado ? 'border-t-[#00D443]' : 'border-t-[#0097b2]'
              }`}
            />
          </div>
        </div>

        <div
          className="pointer-events-none absolute bottom-2 right-2 z-20 rounded-md bg-black/45 px-2 py-0.5 text-xs font-semibold tabular-nums text-white"
          aria-live="polite"
        >
          {Math.round(yawGraus)}°
        </div>
      </div>
    </div>
  )
}
