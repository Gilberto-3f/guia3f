/** Código de país usado nas abas de canal (BR / PY / AR). */
export type CodigoPaisEmpresa = 'BR' | 'PY' | 'AR'

const EMOJI_POR_CODIGO: Record<CodigoPaisEmpresa, string> = {
  BR: '🇧🇷',
  PY: '🇵🇾',
  AR: '🇦🇷',
}

const CIDADE_PARA_CODIGO: Record<string, CodigoPaisEmpresa> = {
  'foz do iguacu': 'BR',
  'foz do iguaçu': 'BR',
  foz: 'BR',
  'ciudad del este': 'PY',
  cde: 'PY',
  'puerto iguazu': 'AR',
  'puerto iguazú': 'AR',
}

/**
 * Infere país a partir de `empresas.cidade` (cadastro).
 */
export function inferCodigoPaisEmpresa(cidade: string | null | undefined): CodigoPaisEmpresa | null {
  const c = String(cidade ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (!c) return null
  if (CIDADE_PARA_CODIGO[c]) return CIDADE_PARA_CODIGO[c]
  if (c.includes('foz')) return 'BR'
  if (c.includes('ciudad del este') || c.includes('cde')) return 'PY'
  if (c.includes('puerto iguazu') || c.includes('iguazu')) return 'AR'
  return null
}

export function emojiBandeiraPais(codigo: CodigoPaisEmpresa | null | undefined): string {
  if (!codigo) return ''
  return EMOJI_POR_CODIGO[codigo] ?? ''
}
