import { normalizarCategoriasProfissional } from '@/lib/cartaoVisitaProfissional'

/** Modo de operação do profissional guia. */
export type ModoGuia = 'guia' | 'agencia'

export const STORAGE_MODO_GUIA = 'guia3f_guia_modo'

export const CATEGORIA_EMPRESA_AGENCIA_GUIA = 'Serviços Locais' as const

export function categoriasIncluemGuia(
  categorias: readonly string[] | string | null | undefined,
): boolean {
  if (categorias == null) return false
  const cats = normalizarCategoriasProfissional(
    typeof categorias === 'string' ? [categorias] : Array.isArray(categorias) ? [...categorias] : null,
  )
  return cats.includes('guia')
}

export function lerModoGuiaStorage(): ModoGuia {
  if (typeof window === 'undefined') return 'guia'
  try {
    const raw = localStorage.getItem(STORAGE_MODO_GUIA)
    return raw === 'agencia' ? 'agencia' : 'guia'
  } catch {
    return 'guia'
  }
}

export function gravarModoGuiaStorage(modo: ModoGuia): void {
  try {
    localStorage.setItem(STORAGE_MODO_GUIA, modo)
  } catch {
    /* ignore */
  }
}

/**
 * Variante de UI — força 'empresa' no modo agência liberado.
 * Não altera usuarios.role.
 */
export function resolverVarianteUiGuia(opts: {
  userRole: string | null
  modoApresentacaoTipo?: string | null
  ehGuia?: boolean
  modoGuia?: ModoGuia | null
}): string | null {
  if (opts.modoApresentacaoTipo) return opts.modoApresentacaoTipo
  const role = opts.userRole
  if (role === 'profissional' && opts.ehGuia && opts.modoGuia === 'agencia') {
    return 'empresa'
  }
  return role
}

/** Canais: guia mantém lista profissional mesmo em modo agência. */
export function guiaUsaCanaisProfissionais(userRole: string | null, ehGuia: boolean): boolean {
  return userRole === 'profissional' && ehGuia
}

export function profissionalOperaComoEmpresaAgencia(
  role: string | null | undefined,
  ehGuia: boolean,
  modo: ModoGuia | null | undefined,
  empresaAgenciaId: string | null | undefined,
  empresaAgenciaLiberada = false,
): boolean {
  return (
    role === 'profissional' &&
    ehGuia &&
    modo === 'agencia' &&
    empresaAgenciaLiberada === true &&
    empresaAgenciaId != null &&
    String(empresaAgenciaId).trim() !== ''
  )
}
