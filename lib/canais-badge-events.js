/** Atualiza só o badge do ícone Canal na BottomBar (não confundir com atividades / coração). */
export const GUIA_CANAIS_BADGE_EVENT = 'guia-canais-badge'

export function notificarBadgeCanais() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(GUIA_CANAIS_BADGE_EVENT))
}
