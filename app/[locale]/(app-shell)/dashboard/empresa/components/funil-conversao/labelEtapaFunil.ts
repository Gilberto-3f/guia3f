export type EtapaFunilId = 'visualizacoes' | 'interacoes' | 'recomendacoes' | 'pax' | 'vendas'

/** Números com 4+ dígitos (ex.: 1.000) ativam rótulos compactos no funil. */
export function funilModoCompacto(valor: number): boolean {
  return valor >= 1000
}

/** 0–1: singular; 2+: plural (PAX permanece invariável). */
export function labelEtapaFunil(id: EtapaFunilId, valor: number): string {
  const plural = valor >= 2
  const compacto = funilModoCompacto(valor)

  switch (id) {
    case 'visualizacoes':
      if (compacto) return plural ? 'VISUALIZAÇÕES' : 'VISUALIZAÇÃO'
      return plural ? 'VISUALIZAÇÕES DA PÁGINA' : 'VISUALIZAÇÃO DA PÁGINA'
    case 'interacoes':
      if (compacto) return plural ? 'INTERAÇÕES' : 'INTERAÇÃO'
      return plural ? 'INTERAÇÕES NA PÁGINA' : 'INTERAÇÃO NA PÁGINA'
    case 'recomendacoes':
      return plural ? 'RECOMENDAÇÕES' : 'RECOMENDAÇÃO'
    case 'pax':
      return 'PAX'
    case 'vendas':
      return plural ? 'VENDAS' : 'VENDA'
    default:
      return ''
  }
}
