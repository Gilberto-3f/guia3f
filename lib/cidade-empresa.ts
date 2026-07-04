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

/** Segmento Lojas do Paraguai (Drena-Stok e aba extra no dashboard). */
export function empresaEhSegmentoLojasParaguai(
  categoria: string | null | undefined,
  cidade: string | null | undefined,
): boolean {
  const cat = normalizarCidade(categoria).replace(/\s+/g, ' ')
  const categoriaOk =
    cat === 'lojas' || cat === 'compras paraguai' || cat.replace(/\s+/g, '') === 'comprasparaguai'
  return categoriaOk && cidadeEhCiudadDelEste(cidade)
}

/** Loja em Foz do Iguaçu ou Puerto Iguazú → fluxo chamar corrida */
export function cidadeEhFozOuPuertoIguazu(cidade: string | null | undefined): boolean {
  const n = normalizarCidade(cidade)
  if (!n) return false
  const foz = n.includes('foz') && n.includes('igu')
  const puerto = n.includes('puerto') && n.includes('iguazu')
  return foz || puerto
}

/** Lojas em Foz ou Puerto Iguazú — endereço já é destino na mobilidade (sem menu Botão Dinâmico). */
export function empresaEhLojasBrasilOuArgentina(
  categoria: string | null | undefined,
  cidade: string | null | undefined,
): boolean {
  const cat = normalizarCidade(categoria).replace(/\s+/g, ' ')
  return cat === 'lojas' && cidadeEhFozOuPuertoIguazu(cidade)
}
