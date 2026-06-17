/** Atualiza badge do Chat ADM no menu lateral. */
export const GUIA_CHAT_ADM_BADGE_EVENT = 'guia-chat-adm-badge'

export function notificarBadgeChatAdm() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(GUIA_CHAT_ADM_BADGE_EVENT))
}
