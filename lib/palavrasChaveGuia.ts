/** Normaliza termo para comparação (busca e palavras-chave). */
export function normalizarTermoBusca(raw: string): string {
  return String(raw ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export const MAX_PALAVRAS_CHAVE = 5

/** Sanitiza lista de palavras-chave (máx. 5, sem vazios). */
export function sanitizarPalavrasChave(raw: unknown): string[] {
  const lista = Array.isArray(raw) ? raw : []
  const out: string[] = []
  for (const item of lista) {
    const t = String(item ?? '').trim()
    if (!t) continue
    if (out.some((x) => normalizarTermoBusca(x) === normalizarTermoBusca(t))) continue
    out.push(t)
    if (out.length >= MAX_PALAVRAS_CHAVE) break
  }
  return out
}

/** Verifica se o termo de busca corresponde a alguma palavra-chave da empresa. */
export function empresaCorrespondeBusca(palavrasChave: unknown, termoBusca: string): boolean {
  const termo = normalizarTermoBusca(termoBusca)
  if (!termo) return true

  const chaves = sanitizarPalavrasChave(palavrasChave)
  if (chaves.length === 0) return false

  return chaves.some((chave) => {
    const k = normalizarTermoBusca(chave)
    if (!k) return false
    return k.includes(termo) || termo.includes(k)
  })
}
