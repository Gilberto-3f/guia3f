export type EtapaFunilId = 'visualizacoes' | 'interacoes' | 'recomendacoes' | 'pax' | 'vendas'

/** 0–1: singular; 2+: plural (PAX permanece invariável). */
export function labelEtapaFunil(id: EtapaFunilId, valor: number): string {
  const plural = valor >= 2
  switch (id) {
    case 'visualizacoes':
      return plural ? 'visualizações da página' : 'visualização da página'
    case 'interacoes':
      return plural ? 'interações na página' : 'interação na página'
    case 'recomendacoes':
      return plural ? 'recomendações' : 'recomendação'
    case 'pax':
      return 'PAX'
    case 'vendas':
      return plural ? 'vendas' : 'venda'
    default:
      return ''
  }
}
