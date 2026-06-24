/** Modo de operação do profissional anfitrião. */
export type ModoAnfitriao = 'anfitriao' | 'hospedagem'

export const STORAGE_MODO_ANFITRIAO = 'guia3f_anfitriao_modo'

export const CATEGORIA_EMPRESA_HOSPEDAGEM_ANFITRIAO = 'Hospedagem' as const

/** Categorias comercializáveis no cadastro empresa (sem Hospedagem). */
export const CATEGORIAS_EMPRESA_COMERCIAL = [
  'Restaurantes',
  'Atrativos',
  'Lojas',
  'Serviços Locais',
] as const

export type CategoriaEmpresaComercial = (typeof CATEGORIAS_EMPRESA_COMERCIAL)[number]

export function normalizarCategoriaSlug(c: string): string {
  return c
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function categoriasIncluemAnfitriao(categorias: readonly string[] | null | undefined): boolean {
  return (categorias ?? []).some((c) => normalizarCategoriaSlug(String(c)) === 'anfitriao')
}

export function ehCategoriaEmpresaComercial(valor: string | null | undefined): boolean {
  const v = String(valor ?? '').trim()
  return (CATEGORIAS_EMPRESA_COMERCIAL as readonly string[]).includes(v)
}

export function lerModoAnfitriaoStorage(): ModoAnfitriao {
  if (typeof window === 'undefined') return 'anfitriao'
  try {
    const raw = localStorage.getItem(STORAGE_MODO_ANFITRIAO)
    return raw === 'hospedagem' ? 'hospedagem' : 'anfitriao'
  } catch {
    return 'anfitriao'
  }
}

export function gravarModoAnfitriaoStorage(modo: ModoAnfitriao): void {
  try {
    localStorage.setItem(STORAGE_MODO_ANFITRIAO, modo)
  } catch {
    /* ignore */
  }
}

export type ResolveVarianteUiOpts = {
  userRole: string | null
  modoApresentacaoTipo?: string | null
  ehAnfitriao?: boolean
  modoAnfitriao?: ModoAnfitriao | null
}

/** Variante de UI (menu, dashboard, barra) — não altera `usuarios.role`. */
export function resolverVarianteUi(opts: ResolveVarianteUiOpts): string | null {
  if (opts.modoApresentacaoTipo) return opts.modoApresentacaoTipo
  const role = opts.userRole
  if (
    role === 'profissional' &&
    opts.ehAnfitriao &&
    opts.modoAnfitriao === 'hospedagem'
  ) {
    return 'empresa'
  }
  return role
}

/** Canais: anfitrião mantém lista profissional mesmo em modo hospedagem. */
export function anfitriaoUsaCanaisProfissionais(userRole: string | null, ehAnfitriao: boolean): boolean {
  return userRole === 'profissional' && ehAnfitriao
}

export function rotuloDestinoNotificacaoFinanceira(
  item: { empresa_id?: string | null; profissional_id?: string | null },
): 'anfitriao' | 'hospedagem' | null {
  if (item.empresa_id) return 'hospedagem'
  if (item.profissional_id) return 'anfitriao'
  return null
}

export function rotuloDestinoNotificacaoFinanceiraTexto(destino: 'anfitriao' | 'hospedagem' | null): string | null {
  if (destino === 'anfitriao') return 'Anfitrião'
  if (destino === 'hospedagem') return 'Hospedagem'
  return null
}

export function profissionalOperaComoEmpresaHospedagem(
  role: string | null | undefined,
  ehAnfitriao: boolean,
  modo: ModoAnfitriao | null | undefined,
  empresaHospedagemId: string | null | undefined,
): boolean {
  return (
    role === 'profissional' &&
    ehAnfitriao &&
    modo === 'hospedagem' &&
    empresaHospedagemId != null &&
    String(empresaHospedagemId).trim() !== ''
  )
}
