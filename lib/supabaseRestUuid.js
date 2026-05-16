/**
 * Valores para filtros `.eq` / `.match` em colunas UUID no PostgREST.
 * Remove espaços e garante string estável (evita edge cases em políticas/triggers).
 * @param {unknown} id
 * @returns {string | null}
 */
export function asUuidFilter(id) {
  if (id == null || id === '') return null
  const s = typeof id === 'string' ? id.trim() : String(id).trim()
  return s.length > 0 ? s : null
}
