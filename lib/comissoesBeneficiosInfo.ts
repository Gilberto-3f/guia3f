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

export type BeneficiosOfertaRecord = Record<
  string,
  { ativo?: boolean; valor?: number; texto?: string; por_tempo_limitado?: boolean }
>

/** Lista vertical de benefícios ativos para histórico / cards. */
export function listarBeneficiosOferta(b: BeneficiosOfertaRecord): { label: string; valor: string }[] {
  const itens: { label: string; valor: string }[] = []
  if (b.pax?.ativo) itens.push({ label: ROTULOS_BENEFICIO.pax, valor: `R$ ${b.pax.valor ?? 0}` })
  if (b.percentual?.ativo) {
    itens.push({ label: ROTULOS_BENEFICIO.percentual, valor: `${b.percentual.valor ?? 0}%` })
  }
  if (b.fixo?.ativo) itens.push({ label: ROTULOS_BENEFICIO.fixo, valor: `R$ ${b.fixo.valor ?? 0}` })
  if (b.extra?.ativo && String(b.extra.texto ?? '').trim()) {
    itens.push({ label: ROTULOS_BENEFICIO.extra, valor: String(b.extra.texto).trim() })
  }
  return itens
}

export type StatusOfertaComissao = 'pendente' | 'aprovada' | 'reprovada' | 'removido' | string

/** Oferta que ocupa a “vaga” da comunidade (ainda não removida/recusada). */
export const STATUS_OFERTA_ATIVA = ['pendente', 'aprovada'] as const

export function isStatusOfertaAtiva(status: StatusOfertaComissao): boolean {
  const s = String(status ?? '').toLowerCase()
  return s === 'pendente' || s === 'aprovada'
}

/** Mapa comunidade → oferta ativa mais recente (ofertas em ordem desc por created_at). */
export function mapaOfertasAtivasPorComunidade(
  ofertas: Array<{ categoria_profissional?: unknown; status?: unknown; id?: unknown; created_at?: unknown }>
): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>()
  for (const o of ofertas) {
    const cat = String(o.categoria_profissional ?? '').trim()
    if (!cat || map.has(cat)) continue
    if (!isStatusOfertaAtiva(String(o.status ?? ''))) continue
    map.set(cat, o as Record<string, unknown>)
  }
  return map
}

export function rotuloStatusOferta(status: StatusOfertaComissao): string {
  const s = String(status ?? 'pendente').toLowerCase()
  if (s === 'aprovada') return 'Aprovada'
  if (s === 'pendente') return 'Pendente'
  if (s === 'reprovada') return 'Recusada'
  if (s === 'removido') return 'Removido'
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function classeStatusOferta(status: StatusOfertaComissao): string {
  const s = String(status ?? 'pendente').toLowerCase()
  if (s === 'aprovada') return 'text-green-600'
  if (s === 'pendente') return 'text-[#0097b2]'
  if (s === 'reprovada' || s === 'removido') return 'text-red-600'
  return 'text-gray-500'
}

export function ofertaPodeSerRemovidaPelaEmpresa(status: StatusOfertaComissao): boolean {
  return String(status ?? '').toLowerCase() !== 'removido'
}
