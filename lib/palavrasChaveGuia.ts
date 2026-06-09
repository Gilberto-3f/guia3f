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

export type EmpresaBuscaGuia = {
  palavras_chave?: unknown
  nome_fantasia?: string | null
  nome_usuario?: string | null
}

function textoCorrespondeTermo(texto: string | null | undefined, termo: string): boolean {
  const alvo = normalizarTermoBusca(texto)
  if (!alvo) return false
  return alvo.includes(termo) || termo.includes(alvo)
}

/** Verifica se o termo corresponde a palavras-chave, nome fantasia ou username da empresa. */
export function empresaCorrespondeBusca(empresa: EmpresaBuscaGuia, termoBusca: string): boolean {
  const termo = normalizarTermoBusca(termoBusca)
  if (!termo) return true

  if (textoCorrespondeTermo(empresa.nome_fantasia, termo)) return true

  const username = String(empresa.nome_usuario ?? '')
    .trim()
    .replace(/^@+/, '')
  if (textoCorrespondeTermo(username, termo)) return true

  const chaves = sanitizarPalavrasChave(empresa.palavras_chave)
  return chaves.some((chave) => textoCorrespondeTermo(chave, termo))
}
