/** Caminho relativo seguro pós-login (cadastro ou retorno a conteúdo público). */
const AUTH_NEXT_RE =
  /^\/(cadastro\/(turista|profissional|empresa)|empresa\/[0-9a-f-]{36})(\/.*)?$/i

/**
 * @param {string | null | undefined} nextParam
 * @returns {string | null}
 */
export function getSafeAuthNext(nextParam) {
  if (nextParam == null || typeof nextParam !== 'string') return null
  let s
  try {
    s = decodeURIComponent(nextParam.trim())
  } catch {
    return null
  }
  const pathOnly = s.split('?')[0] ?? s
  if (!pathOnly.startsWith('/')) return null
  if (!AUTH_NEXT_RE.test(pathOnly)) return null
  return pathOnly.replace(/\/$/, '') || pathOnly
}

/** Alias histórico (login / cadastro). */
export function getSafeCadastroNext(nextParam) {
  return getSafeAuthNext(nextParam)
}
