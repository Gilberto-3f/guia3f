/** Status de empresa elegível no guia turístico (verificadas / operacionais). */
export const STATUS_EMPRESA_GUIA_PUBLICO = ['aprovado', 'ativo'] as const

export type EmpresaLinhaGuia = {
  status?: string | null
  docs_verificado?: boolean | null
  foto_url?: string | null
  somente_modo_apresentacao?: boolean | null
}

/** Critério de exibição no guia: documentação conferida + status liberado + foto de perfil. */
export function empresaElegivelGuiaPublico(row: EmpresaLinhaGuia | null | undefined): boolean {
  if (!row) return false
  if (row.somente_modo_apresentacao === true) return false
  if (row.docs_verificado !== true) return false
  const status = String(row.status ?? '').toLowerCase()
  if (!STATUS_EMPRESA_GUIA_PUBLICO.includes(status as (typeof STATUS_EMPRESA_GUIA_PUBLICO)[number])) {
    return false
  }
  const foto = String(row.foto_url ?? '').trim()
  return foto.length > 0
}

/**
 * Aplica filtros padrão do guia em uma query Supabase de `empresas`.
 * Inclui empresas em degustação verificadas (mesmo critério de assinante regular).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function aplicarFiltroEmpresasGuiaPublico(query: any): any {
  return query
    .eq('docs_verificado', true)
    .in('status', [...STATUS_EMPRESA_GUIA_PUBLICO])
    .eq('somente_modo_apresentacao', false)
    .not('foto_url', 'is', null)
}
