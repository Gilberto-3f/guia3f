/** Largura fixa do tooltip — texto quebra naturalmente (menos cumprimento horizontal). */
export const LARGURA_POPUP_INFO_PX = 168

export type TipoBeneficioComissao =
  | 'pax'
  | 'percentual'
  | 'fixo'
  | 'extra'
  | 'percentual_diaria'
  | 'valor_fixo_diaria'

export const INFO_BENEFICIO_TEXTO: Record<TipoBeneficioComissao, string> = {
  pax: 'Comissão paga por passageiro que trouxerem no local da empresa.',
  percentual:
    'Comissão paga sobre uma porcentagem da compra ou consumo do cliente na empresa.',
  fixo: 'Comissão de valor fixo por passageiro que consumir ou comprar na empresa.',
  extra:
    'Um benefício particular e personalizado que a empresa oferece além das comissões.',
  percentual_diaria:
    'Comissão paga como porcentagem sobre o valor das diárias reservadas na hospedagem.',
  valor_fixo_diaria:
    'Comissão de valor fixo por cada diária reservada na hospedagem.',
}

export const ROTULOS_BENEFICIO: Record<TipoBeneficioComissao, string> = {
  pax: 'PAX',
  percentual: 'PORCENTAGEM',
  fixo: 'INDICAÇÃO',
  extra: 'BENEFÍCIO EXTRA',
  percentual_diaria: '% DAS DIÁRIAS',
  valor_fixo_diaria: 'VALOR FIXO POR DIÁRIA',
}

/** Empresa do segmento Hospedagem (inclui perfil anfitrião com somente_anfitriao). */
export function empresaUsaComissaoDiarias(
  empresa: { categoria?: unknown; somente_anfitriao?: unknown } | null | undefined,
): boolean {
  if (!empresa) return false
  if (empresa.somente_anfitriao === true) return true
  return String(empresa.categoria ?? '').toLowerCase() === 'hospedagem'
}

export function isBeneficiosModoHospedagem(b: BeneficiosOfertaRecord): boolean {
  if (b.modo_hospedagem === true) return true
  const pct = b.percentual_diaria
  const fixo = b.valor_fixo_diaria
  return Boolean(
    (pct && typeof pct === 'object' && pct.ativo) ||
      (fixo && typeof fixo === 'object' && fixo.ativo),
  )
}

export type BeneficiosOfertaRecord = Record<
  string,
  { ativo?: boolean; valor?: number; texto?: string; por_tempo_limitado?: boolean } | boolean | undefined
>

/** Lista vertical de benefícios ativos para histórico / cards. */
export function listarBeneficiosOferta(b: BeneficiosOfertaRecord): { label: string; valor: string }[] {
  const itens: { label: string; valor: string }[] = []
  if (isBeneficiosModoHospedagem(b)) {
    const pct = b.percentual_diaria
    const fixo = b.valor_fixo_diaria
    if (pct && typeof pct === 'object' && pct.ativo) {
      itens.push({
        label: ROTULOS_BENEFICIO.percentual_diaria,
        valor: `${pct.valor ?? 0}%`,
      })
    }
    if (fixo && typeof fixo === 'object' && fixo.ativo) {
      itens.push({
        label: ROTULOS_BENEFICIO.valor_fixo_diaria,
        valor: `R$ ${fixo.valor ?? 0}`,
      })
    }
    return itens
  }
  const pax = b.pax
  const pct = b.percentual
  const fixo = b.fixo
  const extra = b.extra
  if (pax && typeof pax === 'object' && pax.ativo) {
    itens.push({ label: ROTULOS_BENEFICIO.pax, valor: `R$ ${pax.valor ?? 0}` })
  }
  if (pct && typeof pct === 'object' && pct.ativo) {
    itens.push({ label: ROTULOS_BENEFICIO.percentual, valor: `${pct.valor ?? 0}%` })
  }
  if (fixo && typeof fixo === 'object' && fixo.ativo) {
    itens.push({ label: ROTULOS_BENEFICIO.fixo, valor: `R$ ${fixo.valor ?? 0}` })
  }
  if (extra && typeof extra === 'object' && extra.ativo && String(extra.texto ?? '').trim()) {
    itens.push({ label: ROTULOS_BENEFICIO.extra, valor: String(extra.texto).trim() })
  }
  return itens
}

type BeneficioValor = { ativo?: boolean; valor?: number; texto?: string }

function beneficioComValor(obj: BeneficioValor | undefined, exigeTexto = false): boolean {
  if (!obj || typeof obj !== 'object') return false
  if (obj.ativo === true) return true
  if (exigeTexto) return String(obj.texto ?? '').trim().length > 0
  return Number(obj.valor ?? 0) > 0
}

/** Histórico/arquivo ADM: exibe proposta mesmo se flags `ativo` foram desligadas após decisão. */
export function listarBeneficiosProposta(b: BeneficiosOfertaRecord): { label: string; valor: string }[] {
  const ativos = listarBeneficiosOferta(b)
  if (ativos.length > 0) return ativos

  const itens: { label: string; valor: string }[] = []
  if (isBeneficiosModoHospedagem(b)) {
    const pct = b.percentual_diaria
    const fixo = b.valor_fixo_diaria
    if (pct && typeof pct === 'object' && beneficioComValor(pct)) {
      itens.push({
        label: ROTULOS_BENEFICIO.percentual_diaria,
        valor: `${pct.valor ?? 0}%`,
      })
    }
    if (fixo && typeof fixo === 'object' && beneficioComValor(fixo)) {
      itens.push({
        label: ROTULOS_BENEFICIO.valor_fixo_diaria,
        valor: `R$ ${fixo.valor ?? 0}`,
      })
    }
    return itens
  }
  const pax = b.pax
  const pct = b.percentual
  const fixo = b.fixo
  const extra = b.extra
  if (pax && typeof pax === 'object' && beneficioComValor(pax)) {
    itens.push({ label: ROTULOS_BENEFICIO.pax, valor: `R$ ${pax.valor ?? 0}` })
  }
  if (pct && typeof pct === 'object' && beneficioComValor(pct)) {
    itens.push({ label: ROTULOS_BENEFICIO.percentual, valor: `${pct.valor ?? 0}%` })
  }
  if (fixo && typeof fixo === 'object' && beneficioComValor(fixo)) {
    itens.push({ label: ROTULOS_BENEFICIO.fixo, valor: `R$ ${fixo.valor ?? 0}` })
  }
  if (extra && typeof extra === 'object' && beneficioComValor(extra, true)) {
    itens.push({ label: ROTULOS_BENEFICIO.extra, valor: String(extra.texto).trim() })
  }
  return itens
}

/** Rótulo do cargo ADM para decisões de comissão (auditoria / cards arquivados). */
export function rotuloAdminDecisaoComissao(adminNivel: number | null | undefined): string {
  const n = Number(adminNivel ?? 0)
  if (n === 1) return 'ADM GERAL'
  if (n === 3) return 'ADM FINANCEIRO'
  if (n === 2) return 'MODERADOR'
  if (n === 4) return 'SUPORTE'
  return 'ADM'
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
