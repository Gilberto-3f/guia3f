/**
 * Username do autor do story original (dono do story repostado).
 * @param {unknown} dadosExtras
 * @param {string} [fallbackUsername]
 * @returns {string}
 */
export function resolverUsernameOriginalRepostStory(dadosExtras, fallbackUsername = '') {
  const ex =
    dadosExtras && typeof dadosExtras === 'object' && !Array.isArray(dadosExtras)
      ? /** @type {Record<string, unknown>} */ (dadosExtras)
      : null

  const candidates = ex
    ? [ex.story_original_author_username, ex.autor_original_username]
    : []

  for (const raw of candidates) {
    if (typeof raw === 'string' && raw.trim() !== '') {
      return raw.trim().replace(/^@+/, '')
    }
  }

  const fb = fallbackUsername != null ? String(fallbackUsername).trim().replace(/^@+/, '') : ''
  return fb || 'alguém'
}

/**
 * @param {unknown} username
 * @returns {string}
 */
export function normalizarUsernameAtividade(username) {
  if (username == null || String(username).trim() === '') return ''
  return String(username).trim().replace(/^@+/, '')
}
