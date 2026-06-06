/** @param {unknown} v */
function asCategorias(v) {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean)
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v)
      if (Array.isArray(p)) return p.map((x) => String(x).trim()).filter(Boolean)
    } catch {
      // ignore
    }
  }
  return []
}

/**
 * Categoria principal do profissional (mensagem de recomendação — sem título de profissão).
 * @param {unknown} categorias
 */
export function rotuloCategoriaProfissionalMensagem(categorias) {
  const lista = asCategorias(categorias)
  if (lista.length === 0) return 'profissional'

  return String(lista[0])
    .toLowerCase()
    .replace(/_/g, ' ')
    .trim()
}
