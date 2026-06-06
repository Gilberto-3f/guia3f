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
      if (compacto) return plural ? 'Visualizações' : 'Visualização'
      return plural ? 'Visualizações da Página' : 'Visualização da Página'
    case 'interacoes':
      if (compacto) return plural ? 'Interações' : 'Interação'
      return plural ? 'Interações na Página' : 'Interação na Página'
    case 'recomendacoes':
      return plural ? 'Recomendações' : 'Recomendação'
    case 'pax':
      return 'PAX'
    case 'vendas':
      return plural ? 'Vendas' : 'Venda'
    default:
      return ''
  }
}
