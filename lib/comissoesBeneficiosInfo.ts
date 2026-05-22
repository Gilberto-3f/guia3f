/** Largura fixa do tooltip — 3 linhas curtas, menos extensão horizontal. */
export const LARGURA_POPUP_INFO_PX = 168

export type TipoBeneficioComissao = 'pax' | 'percentual' | 'fixo' | 'extra'

export const INFO_BENEFICIO_LINHAS: Record<TipoBeneficioComissao, [string, string, string]> = {
  pax: [
    'Comissão paga por passageiro',
    'que trouxerem no local',
    'da empresa.',
  ],
  percentual: [
    'Comissão paga sobre uma',
    'porcentagem da compra ou consumo',
    'do cliente na empresa.',
  ],
  fixo: [
    'Comissão de valor fixo',
    'por passageiro que consumir',
    'ou comprar na empresa.',
  ],
  extra: [
    'Benefício particular e',
    'personalizado que a empresa oferece',
    'além das comissões.',
  ],
}

export const ROTULOS_BENEFICIO: Record<TipoBeneficioComissao, string> = {
  pax: 'PAX',
  percentual: 'PORCENTAGEM',
  fixo: 'INDICAÇÃO',
  extra: 'BENEFÍCIO EXTRA',
}
