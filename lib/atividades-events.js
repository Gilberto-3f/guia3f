/** Evento para recarregar a lista em `/atividades` (abas Amigos e Minha conta). */
export const GUIA_ATIVIDADES_RELOAD_EVENT = 'guia-atividades-reload'

/**
 * Dispara refresh da página de atividades e do badge na BottomBar após curtir/descurtir
 * (o trigger no banco já remove/cria linhas em `public.atividades`).
 */
export function notificarEngajamentoAtividades() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(GUIA_ATIVIDADES_RELOAD_EVENT))
  window.dispatchEvent(new Event('perfil-atualizado'))
}
