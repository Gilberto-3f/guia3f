/** Caminho relativo seguro pós-login vindo da escolha de perfil */
const CADASTRO_NEXT_RE = /^\/cadastro\/(turista|profissional|empresa)\/?$/

/**
 * @param {string | null | undefined} nextParam
 * @returns {string | null}
 */
export function getSafeCadastroNext(nextParam) {
  if (nextParam == null || typeof nextParam !== 'string') return null
  let s
  try {
    s = decodeURIComponent(nextParam.trim())
  } catch {
    return null
  }
  if (!CADASTRO_NEXT_RE.test(s)) return null
  return s.replace(/\/$/, '') || s
}
