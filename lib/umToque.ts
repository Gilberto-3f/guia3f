import type { MouseEvent, PointerEvent } from 'react'

/**
 * Um toque no celular dispara a ação no pointerdown e descarta o click fantasma.
 * Mouse/teclado continuam no onClick (evita disparo duplo).
 */
export function propsUmToque(acao: () => void, disabled = false) {
  return {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (disabled) return
      if (e.button !== 0) return
      e.stopPropagation()
      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
        e.preventDefault()
        acao()
      }
    },
    onClick: (e: MouseEvent<HTMLElement>) => {
      if (disabled) return
      e.stopPropagation()
      const ne = e.nativeEvent as { pointerType?: unknown }
      const tipo = String(ne.pointerType ?? '')
      if (tipo === 'touch' || tipo === 'pen') {
        e.preventDefault()
        return
      }
      acao()
    },
  }
}
