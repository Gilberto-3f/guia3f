/** Subpáginas do menu lateral exclusivas de profissional (bloqueadas sem docs verificados). */
export const SUBPAGINAS_PROF_BLOQUEADAS_DOCS = new Set([
  'comissoes',
  'tabela',
  // mobilidade-perfil liberado: contém pasta Anexar documentos do fluxo de verificação
  'parcerias',
  'recomendacoes',
])

/** Grupos do menu lateral bloqueados até verificação ADM. */
export const GRUPOS_MENU_PROF_BLOQUEADOS_DOCS = new Set(['profissional', 'anfitriao'])

/**
 * @param {string | undefined | null} subpagina
 * @param {boolean} recursosLiberados
 * @param {string | undefined | null} variant
 */
export function subpaginaProfissionalBloqueadaPorDocs(subpagina, recursosLiberados, variant) {
  if (variant !== 'profissional' || recursosLiberados) return false
  return SUBPAGINAS_PROF_BLOQUEADAS_DOCS.has(String(subpagina ?? ''))
}
