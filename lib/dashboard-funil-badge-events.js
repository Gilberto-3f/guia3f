/** Atualiza badges do funil (dashboard empresa) na barra e no painel. */
export const GUIA_FUNIL_BADGE_EVENT = 'guia-funil-badge'

export function notificarBadgeFunil() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(GUIA_FUNIL_BADGE_EVENT))
}
