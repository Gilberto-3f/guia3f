/** Atualiza badges do funil (dashboard empresa) na barra e no painel. */
export const GUIA_FUNIL_BADGE_EVENT = 'guia-funil-badge'

/**
 * @param {{ total?: number, etapa?: 'recomendacoes' | 'pax' | 'vendas' }} [detail]
 *   — `total`: barra aplica sem esperar o banco; `etapa`: zera badge da etapa no painel do funil.
 */
export function notificarBadgeFunil(detail) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(GUIA_FUNIL_BADGE_EVENT, { detail: detail ?? null }))
}
