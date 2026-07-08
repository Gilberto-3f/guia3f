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
 * @typedef {{
 *   autorId?: string
 *   postId?: string
 *   comentarioId?: string
 *   curtidaId?: string
 *   atividadeId?: string
 * }} RemoverAtividadeCurtidaDetail
 */

/**
 * Após curtir/descurtir: badge + sincronização da lista em `/atividades`.
 * @param {{
 *   sincronizarLista?: boolean
 *   remover?: RemoverAtividadeCurtidaDetail
 * }} [opcoes]
 * - `sincronizarLista: true` após descurtir com sucesso: força reload + `detail` para remoção local imediata.
 * - `remover`: critérios para sumir a linha antes do refetch (mesma janela).
 */
export function notificarEngajamentoAtividades(opcoes) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(GUIA_ATIVIDADES_BADGE_EVENT))
  if (opcoes?.sincronizarLista || isPaginaAtividadesFeed()) {
    window.dispatchEvent(
      new CustomEvent(GUIA_ATIVIDADES_RELOAD_EVENT, {
        detail: opcoes?.remover ?? null,
      })
    )
  }
}

/** Zera o badge do coração na barra sem refetch pesado (aba Minha conta lida). */
export function zerarBadgeAtividadesMinhaConta() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(GUIA_ATIVIDADES_BADGE_EVENT, {
      detail: { zero: true },
    })
  )
}
