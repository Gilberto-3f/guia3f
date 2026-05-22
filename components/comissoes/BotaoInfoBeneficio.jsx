'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'
import { INFO_BENEFICIO_TEXTO, LARGURA_POPUP_INFO_PX } from '@/lib/comissoesBeneficiosInfo'

/**
 * @param {{
 *   tipo: import('@/lib/comissoesBeneficiosInfo').TipoBeneficioComissao
 *   aberto: boolean
 *   onToggle: () => void
 *   onFechar: () => void
 * }} props
 */
export default function BotaoInfoBeneficio({ tipo, aberto, onToggle, onFechar }) {
  const btnRef = useRef(/** @type {HTMLButtonElement | null} */ (null))
  const popupRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const [popupPos, setPopupPos] = useState(/** @type {{ top: number; left: number; width: number } | null} */ (null))

  const atualizarPosicao = useCallback(() => {
    const btn = btnRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const largura = Math.min(LARGURA_POPUP_INFO_PX, window.innerWidth - 24)
    const left = Math.max(12, Math.min(rect.right - largura, window.innerWidth - largura - 12))
    setPopupPos({
      top: rect.bottom + 10,
      left,
      width: largura,
    })
  }, [])

  useEffect(() => {
    if (!aberto) {
      setPopupPos(null)
      return
    }
    atualizarPosicao()
    window.addEventListener('resize', atualizarPosicao)
    window.addEventListener('scroll', atualizarPosicao, true)
    return () => {
      window.removeEventListener('resize', atualizarPosicao)
      window.removeEventListener('scroll', atualizarPosicao, true)
    }
  }, [aberto, atualizarPosicao])

  useEffect(() => {
    if (!aberto) return
    const onPointerDown = (e) => {
      const alvo = /** @type {Node} */ (e.target)
      if (btnRef.current?.contains(alvo) || popupRef.current?.contains(alvo)) return
      onFechar()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [aberto, onFechar])

  const popup =
    aberto && popupPos && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={popupRef}
            role="tooltip"
            style={{ position: 'fixed', top: popupPos.top, left: popupPos.left, width: popupPos.width }}
            className="z-[200] rounded-lg bg-[#0097b2] px-2.5 py-2 text-left text-[11px] leading-snug text-white shadow-lg"
          >
            {INFO_BENEFICIO_TEXTO[tipo]}
          </div>,
          document.body
        )
      : null

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
        className="flex h-7 w-7 items-center justify-center rounded-full text-[#0097b2] transition hover:bg-[#0097b2]/10"
        aria-label={`Informações sobre ${tipo}`}
        aria-expanded={aberto}
      >
        <Info className="h-4 w-4" strokeWidth={2.25} aria-hidden />
      </button>
      {popup}
    </div>
  )
}
