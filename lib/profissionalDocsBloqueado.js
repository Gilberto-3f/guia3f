/** Subpáginas do menu lateral exclusivas de profissional (bloqueadas sem docs verificados). */
export const SUBPAGINAS_PROF_BLOQUEADAS_DOCS = new Set([
  'comissoes',
  'parcerias-prof',
  'manifestos',
  'tabela',
  'agendamento',
  'historico-manifestos',
  'parcerias',
  'recomendacoes',
])

/** Grupos / subgrupos do menu lateral bloqueados até verificação ADM. */
export const GRUPOS_MENU_PROF_BLOQUEADOS_DOCS = new Set(['profissional'])
export const SUBGRUPOS_MENU_PROF_BLOQUEADOS_DOCS = new Set(['aplic-prof-hist'])

/**
 * @param {string | undefined | null} subpagina
 * @param {boolean} recursosLiberados
 * @param {string | undefined | null} variant
 */
export function subpaginaProfissionalBloqueadaPorDocs(subpagina, recursosLiberados, variant) {
  if (variant !== 'profissional' || recursosLiberados) return false
  return SUBPAGINAS_PROF_BLOQUEADAS_DOCS.has(String(subpagina ?? ''))
}
