/** Atualiza badges do funil (dashboard empresa) na barra e no painel. */
export const GUIA_FUNIL_BADGE_EVENT = 'guia-funil-badge'

/** Métricas/detalhes do funil devem recarregar (nova recomendação etc.). */
export const GUIA_FUNIL_METRICAS_EVENT = 'guia-funil-metricas'

/**
 * @param {{ total?: number, etapa?: 'recomendacoes' | 'pax' | 'vendas' }} [detail]
 *   — `total`: barra aplica sem esperar o banco; `etapa`: zera badge da etapa no painel do funil.
 */
export function notificarBadgeFunil(detail) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(GUIA_FUNIL_BADGE_EVENT, { detail: detail ?? null }))
}

/** Avisa painel do funil para atualizar contagens/detalhes o quanto antes. */
export function notificarMetricasFunil() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(GUIA_FUNIL_METRICAS_EVENT))
}
