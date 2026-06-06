/** Atualiza badges do funil (dashboard empresa) na barra e no painel. */
export const GUIA_FUNIL_BADGE_EVENT = 'guia-funil-badge'

/**
 * @param {{ total?: number }} [detail] — quando informado, a barra aplica o total sem esperar o banco.
 */
export function notificarBadgeFunil(detail) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(GUIA_FUNIL_BADGE_EVENT, { detail: detail ?? null }))
}
