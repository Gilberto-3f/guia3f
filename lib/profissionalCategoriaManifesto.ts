/** Guia acompanha roteiro presencial — exige check-ins no itinerário. */
export function profissionalEhGuia(categorias: unknown): boolean {
  const cats = normalizarCategorias(categorias)
  return cats.some((c) => c === 'guia' || c === 'guia_turistico' || c.includes('guia'))
}

/** Van: foco em transfer / lista PAX — pode concluir sem check-ins de itinerário. */
export function profissionalEhVan(categorias: unknown): boolean {
  const cats = normalizarCategorias(categorias)
  return cats.some((c) => c === 'van' || c.includes('van'))
}

function normalizarCategorias(categorias: unknown): string[] {
  if (!Array.isArray(categorias)) return []
  return categorias.map((c) =>
    String(c)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''),
  )
}
