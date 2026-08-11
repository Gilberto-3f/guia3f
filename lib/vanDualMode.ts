import { normalizarCategoriasProfissional } from '@/lib/cartaoVisitaProfissional'

/** Modo de operação do profissional motorista de van. */
export type ModoVan = 'van' | 'agencia'

export const STORAGE_MODO_VAN = 'guia3f_van_modo'

/** Mesmo segmento comercial da agência do guia. */
export const CATEGORIA_EMPRESA_AGENCIA_VAN = 'Serviços Locais' as const

export function categoriasIncluemVan(
  categorias: readonly string[] | string | null | undefined,
): boolean {
  if (categorias == null) return false
  const cats = normalizarCategoriasProfissional(
    typeof categorias === 'string' ? [categorias] : Array.isArray(categorias) ? [...categorias] : null,
  )
  return cats.includes('van')
}

export function lerModoVanStorage(): ModoVan {
  if (typeof window === 'undefined') return 'van'
  try {
    const raw = localStorage.getItem(STORAGE_MODO_VAN)
    return raw === 'agencia' ? 'agencia' : 'van'
  } catch {
    return 'van'
  }
}

export function gravarModoVanStorage(modo: ModoVan): void {
  try {
    localStorage.setItem(STORAGE_MODO_VAN, modo)
  } catch {
    /* ignore */
  }
}

/**
 * Variante de UI — força 'empresa' no modo agência liberado.
 * Não altera usuarios.role.
 */
export function resolverVarianteUiVan(opts: {
  userRole: string | null
  modoApresentacaoTipo?: string | null
  ehVan?: boolean
  modoVan?: ModoVan | null
}): string | null {
  if (opts.modoApresentacaoTipo) return opts.modoApresentacaoTipo
  const role = opts.userRole
  if (role === 'profissional' && opts.ehVan && opts.modoVan === 'agencia') {
    return 'empresa'
  }
  return role
}

/** Canais: van mantém lista profissional mesmo em modo agência (igual anfitrião/guia). */
export function vanUsaCanaisProfissionais(userRole: string | null, ehVan: boolean): boolean {
  return userRole === 'profissional' && ehVan
}

export function profissionalOperaComoEmpresaAgenciaVan(
  role: string | null | undefined,
  ehVan: boolean,
  modo: ModoVan | null | undefined,
  empresaAgenciaVanId: string | null | undefined,
  empresaAgenciaVanLiberada = false,
): boolean {
  return (
    role === 'profissional' &&
    ehVan &&
    modo === 'agencia' &&
    empresaAgenciaVanLiberada === true &&
    empresaAgenciaVanId != null &&
    String(empresaAgenciaVanId).trim() !== ''
  )
}
