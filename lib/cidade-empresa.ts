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

function categoriaEhLojas(categoria: string | null | undefined): boolean {
  const cat = normalizarCidade(categoria).replace(/\s+/g, ' ')
  return (
    cat === 'lojas' || cat === 'compras paraguai' || cat.replace(/\s+/g, '') === 'comprasparaguai'
  )
}

/** Categoria Lojas / Compras Paraguai (qualquer cidade). */
export function empresaCategoriaEhLojas(categoria: string | null | undefined): boolean {
  return categoriaEhLojas(categoria)
}

/** Loja em Ciudad del Este → fluxo produtos / compras Paraguai */
export function cidadeEhCiudadDelEste(cidade: string | null | undefined): boolean {
  const n = normalizarCidade(cidade)
  if (!n) return false
  return n.includes('ciudad') && n.includes('este')
}

/** Segmento Lojas do Paraguai (Drena-Stok, comparador COMPRAS CDE e metatags). */
export function empresaEhSegmentoLojasParaguai(
  categoria: string | null | undefined,
  cidade: string | null | undefined,
): boolean {
  return categoriaEhLojas(categoria) && cidadeEhCiudadDelEste(cidade)
}

/** Loja em Foz do Iguaçu ou Puerto Iguazú */
export function cidadeEhFozOuPuertoIguazu(cidade: string | null | undefined): boolean {
  const n = normalizarCidade(cidade)
  if (!n) return false
  const foz = n.includes('foz') && n.includes('igu')
  const puerto = n.includes('puerto') && n.includes('iguazu')
  return foz || puerto
}

/** Lojas em Foz ou Puerto Iguazú (catálogo próprio; fora do comparador CDE). */
export function empresaEhLojasBrasilOuArgentina(
  categoria: string | null | undefined,
  cidade: string | null | undefined,
): boolean {
  return categoriaEhLojas(categoria) && cidadeEhFozOuPuertoIguazu(cidade)
}

/**
 * Qualquer loja com catálogo de produtos (CDE + Foz + Puerto Iguazú).
 * CDE entra no COMPRAS CDE; BR/AR só divulgação/recomendação.
 */
export function empresaEhLojaComCatalogo(
  categoria: string | null | undefined,
  cidade: string | null | undefined,
): boolean {
  return (
    empresaEhSegmentoLojasParaguai(categoria, cidade) ||
    empresaEhLojasBrasilOuArgentina(categoria, cidade)
  )
}
