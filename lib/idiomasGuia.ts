/** Idiomas disponíveis para o Guia de Turismo (perfil + filtro futuro). */
export const IDIOMAS_GUIA = [
  { codigo: 'pt', label: 'Português', bandeira: '🇧🇷' },
  { codigo: 'es', label: 'Español', bandeira: '🇪🇸' },
  { codigo: 'en', label: 'English', bandeira: '🇺🇸' },
  { codigo: 'fr', label: 'Français', bandeira: '🇫🇷' },
  { codigo: 'de', label: 'Deutsch', bandeira: '🇩🇪' },
  { codigo: 'it', label: 'Italiano', bandeira: '🇮🇹' },
  { codigo: 'zh', label: '中文', bandeira: '🇨🇳' },
  { codigo: 'ja', label: '日本語', bandeira: '🇯🇵' },
  { codigo: 'ko', label: '한국어', bandeira: '🇰🇷' },
  { codigo: 'ru', label: 'Русский', bandeira: '🇷🇺' },
  { codigo: 'gn', label: 'Guarani', bandeira: '🇵🇾' },
] as const

export type IdiomaGuiaCodigo = (typeof IDIOMAS_GUIA)[number]['codigo']

const CODIGOS = new Set<string>(IDIOMAS_GUIA.map((i) => i.codigo))

export function normalizarIdiomasGuia(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    const c = String(item ?? '')
      .trim()
      .toLowerCase()
      .slice(0, 8)
    if (c && CODIGOS.has(c) && !out.includes(c)) out.push(c)
  }
  return out
}

export function labelIdiomaGuia(codigo: string): string {
  const found = IDIOMAS_GUIA.find((i) => i.codigo === codigo)
  return found ? `${found.bandeira} ${found.label}` : codigo
}

export function toggleIdiomaGuia(lista: string[], codigo: string): string[] {
  const c = String(codigo).trim().toLowerCase()
  if (!CODIGOS.has(c)) return lista
  if (lista.includes(c)) return lista.filter((x) => x !== c)
  return [...lista, c]
}
