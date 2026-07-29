import type { ContextoMapaMobilidade } from '@/lib/parceriaMapaMobilidade'

export type VisitanteParceriaMapa = {
  placaVermelha: boolean
  categorias: string[]
  cidadesAtuacao: string[]
}

export type PropsMapaMobilidadeParceria = {
  contextoMapa: ContextoMapaMobilidade
  visitanteParceria: VisitanteParceriaMapa | null
}

export function parseCidadesAtuacaoProf(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((c): c is string => typeof c === 'string' && c.trim() !== '').map(String)
  }
  if (typeof raw === 'string' && raw.trim()) return [raw.trim()]
  return []
}
