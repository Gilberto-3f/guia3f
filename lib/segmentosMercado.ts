/** Cinco segmentos de mercado (Análise de Mercado — dashboard empresa). */
export const SEGMENTOS_MERCADO_ORDEM = [
  'gastronomia',
  'atrativos',
  'lojas',
  'hospedagem',
  'servicos',
] as const

export type SegmentoMercado = (typeof SEGMENTOS_MERCADO_ORDEM)[number]

export const ROTULO_SEGMENTO_MERCADO: Record<SegmentoMercado, string> = {
  gastronomia: 'Gastronomia',
  atrativos: 'Atrativos',
  lojas: 'Lojas',
  hospedagem: 'Hospedagem',
  servicos: 'Serviços',
}

const CORES_SEGMENTO: Record<SegmentoMercado, string> = {
  gastronomia: '#E74C3C',
  atrativos: '#F1C40F',
  lojas: '#9B59B6',
  hospedagem: '#3498DB',
  servicos: '#1ABC9C',
}

export function corSegmentoMercado(segmento: SegmentoMercado): string {
  return CORES_SEGMENTO[segmento]
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Normaliza categoria/slug da empresa para um dos 5 segmentos (ou null se não mapeável). */
export function normalizarSegmentoMercado(raw: string | null | undefined): SegmentoMercado | null {
  const n = stripAccents(String(raw ?? '').trim().toLowerCase())
  if (!n) return null

  if (n.includes('gastronom') || n.includes('restaur') || n === 'gastronomia' || n === 'restaurantes') {
    return 'gastronomia'
  }
  if (n.includes('atrat') || n.includes('passeio') || n === 'passeios') return 'atrativos'
  if (n.includes('loja') || n.includes('paraguai') || n === 'compras paraguai') return 'lojas'
  if (n.includes('hotel') || n.includes('hosped')) return 'hospedagem'
  if (n.includes('servico') || n.includes('serviço') || n.includes('servicos_locais')) return 'servicos'

  return null
}

export interface ContagemSegmento {
  segmento: SegmentoMercado
  label: string
  total: number
  percentual: number
}

export interface ComissaoSegmento {
  segmento: SegmentoMercado
  label: string
  mediaPax: number
  mediaPercentual: number
  mediaIndicacao: number
  quantidade: number
}

export function preencherContagensSegmento(
  parcial: Partial<Record<SegmentoMercado, number>>,
): ContagemSegmento[] {
  const totais = SEGMENTOS_MERCADO_ORDEM.map((seg) => parcial[seg] ?? 0)
  const soma = totais.reduce((a, b) => a + b, 0) || 1

  return SEGMENTOS_MERCADO_ORDEM.map((segmento, i) => ({
    segmento,
    label: ROTULO_SEGMENTO_MERCADO[segmento],
    total: totais[i],
    percentual: soma > 0 ? (totais[i] / soma) * 100 : 0,
  })).sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total
    return SEGMENTOS_MERCADO_ORDEM.indexOf(a.segmento) - SEGMENTOS_MERCADO_ORDEM.indexOf(b.segmento)
  })
}

export function preencherComissaoSegmento(
  parcial: Partial<
    Record<
      SegmentoMercado,
      { mediaPax: number; mediaPercentual: number; mediaIndicacao: number; quantidade: number }
    >
  >,
): ComissaoSegmento[] {
  return SEGMENTOS_MERCADO_ORDEM.map((segmento) => {
    const hit = parcial[segmento]
    return {
      segmento,
      label: ROTULO_SEGMENTO_MERCADO[segmento],
      mediaPax: hit?.mediaPax ?? 0,
      mediaPercentual: hit?.mediaPercentual ?? 0,
      mediaIndicacao: hit?.mediaIndicacao ?? 0,
      quantidade: hit?.quantidade ?? 0,
    }
  }).sort((a, b) => {
    if (b.quantidade !== a.quantidade) return b.quantidade - a.quantidade
    return SEGMENTOS_MERCADO_ORDEM.indexOf(a.segmento) - SEGMENTOS_MERCADO_ORDEM.indexOf(b.segmento)
  })
}

export function paraGraficoPizza(items: ContagemSegmento[]) {
  return items.map((item) => ({
    label: item.label,
    valor: item.total,
    percentual: item.percentual,
    cor: corSegmentoMercado(item.segmento),
  }))
}
