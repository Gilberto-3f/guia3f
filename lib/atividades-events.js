/** Recarrega a lista em `/atividades` (abas Amigos e Minha conta). */
export const GUIA_ATIVIDADES_RELOAD_EVENT = 'guia-atividades-reload'

/** Atualiza só o badge do coração na BottomBar (sem `perfil-atualizado`). */
export const GUIA_ATIVIDADES_BADGE_EVENT = 'guia-atividades-badge'

/**
 * Feed global de atividades (`/atividades`), não o post isolado em `/perfil/atividades`.
 * @param {string} [pathname]
 */
export function isPaginaAtividadesFeed(pathname = typeof window !== 'undefined' ? window.location.pathname : '') {
  const p = String(pathname ?? '')
  if (!p.includes('/atividades')) return false
  if (p.includes('/perfil/atividades')) return false
  return true
}

/**
 * Após curtir/descurtir: badge leve + reload da lista em `/atividades`.
 * @param {{ sincronizarLista?: boolean }} [opcoes]
 * - `sincronizarLista: true` após descurtir com sucesso: força reload (remove linha após trigger no banco).
 * - Sem opção: reload só se a rota `/atividades` estiver aberta (curtir).
 * Não dispara `perfil-atualizado` (evita recarregar feed, stories e comentários).
 */
export function notificarEngajamentoAtividades(opcoes) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(GUIA_ATIVIDADES_BADGE_EVENT))
  if (opcoes?.sincronizarLista || isPaginaAtividadesFeed()) {
    window.dispatchEvent(new Event(GUIA_ATIVIDADES_RELOAD_EVENT))
  }
}
