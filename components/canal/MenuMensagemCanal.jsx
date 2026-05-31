'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bookmark, Flag, HeartHandshake, MoreVertical, Pencil } from 'lucide-react'

/** Largura original (208px) menos dois quintos → 3/5 ≈ 125px */
const MENU_LARGURA_PX = 125
const MARGEM_VIEWPORT_PX = 8

/**
 * Menu da mensagem (estilo MenuPost — fundo azul logo, texto branco).
 * Popup em portal com posição fixa, sempre dentro da viewport.
 * @param {{
 *   salvo?: boolean
 *   podeEditar?: boolean
 *   onEditar?: () => void
 *   onSalvar?: () => void
 *   onDenunciar?: () => void
 *   onInteragir?: () => void
 *   alinhadoDireita?: boolean
 * }} props
 */
export default function MenuMensagemCanal({
  salvo = false,
  podeEditar = false,
  onEditar,
  onSalvar,
  onDenunciar,
  onInteragir,
  alinhadoDireita = true,
}) {
  const [aberto, setAberto] = useState(false)
  const [popupPos, setPopupPos] = useState(/** @type {{ top: number; left: number } | null} */ (null))
  const btnRef = useRef(/** @type {HTMLButtonElement | null} */ (null))
  const popupRef = useRef(/** @type {HTMLDivElement | null} */ (null))

  const atualizarPosicao = useCallback(() => {
    const btn = btnRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const popup = popupRef.current
    const menuW = popup?.offsetWidth ?? MENU_LARGURA_PX
    const menuH = popup?.offsetHeight ?? 120

    let left = alinhadoDireita ? rect.right - menuW : rect.left
    left = Math.max(MARGEM_VIEWPORT_PX, Math.min(left, window.innerWidth - menuW - MARGEM_VIEWPORT_PX))

    let top = rect.bottom + 4
    if (top + menuH > window.innerHeight - MARGEM_VIEWPORT_PX) {
      top = rect.top - menuH - 4
    }
    top = Math.max(MARGEM_VIEWPORT_PX, Math.min(top, window.innerHeight - menuH - MARGEM_VIEWPORT_PX))

    setPopupPos({ top, left })
  }, [alinhadoDireita])

  useLayoutEffect(() => {
    if (!aberto) {
      setPopupPos(null)
      return
    }
    atualizarPosicao()
    const id = requestAnimationFrame(() => atualizarPosicao())
    return () => cancelAnimationFrame(id)
  }, [aberto, atualizarPosicao, podeEditar, onSalvar, onDenunciar, onInteragir])

  useEffect(() => {
    if (!aberto) return
    window.addEventListener('resize', atualizarPosicao)
    window.addEventListener('scroll', atualizarPosicao, true)
    return () => {
      window.removeEventListener('resize', atualizarPosicao)
      window.removeEventListener('scroll', atualizarPosicao, true)
    }
  }, [aberto, atualizarPosicao])

  useEffect(() => {
    if (!aberto) return
    const fechar = (e) => {
      const alvo = /** @type {Node} */ (e.target)
      if (btnRef.current?.contains(alvo) || popupRef.current?.contains(alvo)) return
      setAberto(false)
    }
    document.addEventListener('mousedown', fechar)
    document.addEventListener('touchstart', fechar)
    return () => {
      document.removeEventListener('mousedown', fechar)
      document.removeEventListener('touchstart', fechar)
    }
  }, [aberto])

  const itemClass =
    'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs leading-snug text-white transition-colors hover:bg-[#007a8f]'

  const popup =
    aberto && popupPos && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={popupRef}
            style={{ position: 'fixed', top: popupPos.top, left: popupPos.left, width: MENU_LARGURA_PX }}
            className="z-[200] overflow-hidden rounded-lg bg-[#0097b2] py-0.5 text-white shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {onInteragir ? (
              <button
                type="button"
                onClick={() => {
                  setAberto(false)
                  onInteragir()
                }}
                className={itemClass}
              >
                <HeartHandshake size={14} className="shrink-0 text-white" aria-hidden />
                <span>Interagir</span>
              </button>
            ) : null}
            {podeEditar ? (
              <button
                type="button"
                onClick={() => {
                  setAberto(false)
                  onEditar?.()
                }}
                className={itemClass}
              >
                <Pencil size={14} className="shrink-0 text-white" aria-hidden />
                <span>Editar</span>
              </button>
            ) : null}
            {onSalvar ? (
              <button
                type="button"
                onClick={() => {
                  setAberto(false)
                  onSalvar()
                }}
                className={itemClass}
              >
                <Bookmark size={14} className={`shrink-0 text-white ${salvo ? 'fill-white' : ''}`} aria-hidden />
                <span className="min-w-0 truncate">{salvo ? 'Remover salvo' : 'Salvar'}</span>
              </button>
            ) : null}
            {onDenunciar ? (
              <button
                type="button"
                onClick={() => {
                  setAberto(false)
                  onDenunciar()
                }}
                className={itemClass}
              >
                <Flag size={14} className="shrink-0 text-white" aria-hidden />
                <span>Denunciar</span>
              </button>
            ) : null}
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setAberto((v) => !v)
        }}
        className={`shrink-0 self-center rounded-full p-0.5 text-gray-500 hover:bg-gray-100 max-md:opacity-100 ${
          aberto ? 'bg-gray-100 opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
        aria-label="Opções da mensagem"
        aria-expanded={aberto}
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
      </button>
      {popup}
    </>
  )
}
