/**
 * Normaliza nome de cidade para comparações (acentos, maiúsculas).
 */
export function normalizarCidade(cidade: string | null | undefined): string {
  return String(cidade ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
}

/** Loja em Ciudad del Este → fluxo produtos / compras Paraguai */
export function cidadeEhCiudadDelEste(cidade: string | null | undefined): boolean {
  const n = normalizarCidade(cidade)
  if (!n) return false
  return n.includes('ciudad') && n.includes('este')
}

/** Loja em Foz do Iguaçu ou Puerto Iguazú → fluxo chamar corrida */
export function cidadeEhFozOuPuertoIguazu(cidade: string | null | undefined): boolean {
  const n = normalizarCidade(cidade)
  if (!n) return false
  const foz = n.includes('foz') && n.includes('igu')
  const puerto = n.includes('puerto') && n.includes('iguazu')
  return foz || puerto
}
