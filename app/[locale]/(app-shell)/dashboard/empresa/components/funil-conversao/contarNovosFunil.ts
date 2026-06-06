export function ehNovoDesde(createdAt: string, vistoEm: string): boolean {
  const tNovo = Date.parse(createdAt)
  const tVisto = Date.parse(vistoEm)
  if (!Number.isFinite(tNovo) || !Number.isFinite(tVisto)) return false
  return tNovo > tVisto
}

export function contarNovosEventos(detalhes: { created_at: string }[], vistoEm: string): number {
  return detalhes.filter((d) => ehNovoDesde(d.created_at, vistoEm)).length
}

export function contarNovosPax(detalhes: { created_at: string; pax_qtd: number }[], vistoEm: string): number {
  return detalhes
    .filter((d) => ehNovoDesde(d.created_at, vistoEm))
    .reduce((s, d) => s + (d.pax_qtd > 0 ? d.pax_qtd : 1), 0)
}
