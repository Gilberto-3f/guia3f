import type { MouseEvent, PointerEvent } from 'react'

/** Descarta o click fantasma do iOS após o pointerup (Safari costuma omitir pointerType no click). */
let ultimoToqueEm = 0
const GUARDA_MS = 450

/**
 * Um toque dispara no pointerup (touch/pen) ou no click (mouse/teclado).
 * Não usa preventDefault no pointerdown — no iOS isso come o 1º toque
 * (foco de input, botões sobre o mapa, popups).
 */
export function propsUmToque(acao: () => void, disabled = false) {
  return {
    onPointerUp: (e: PointerEvent<HTMLElement>) => {
      if (disabled) return
      if (e.button !== 0) return
      if (e.pointerType === 'mouse') return
      e.stopPropagation()
      ultimoToqueEm = Date.now()
      acao()
    },
    onClick: (e: MouseEvent<HTMLElement>) => {
      if (disabled) return
      e.stopPropagation()
      if (Date.now() - ultimoToqueEm < GUARDA_MS) {
        e.preventDefault()
        return
      }
      acao()
    },
  }
}
