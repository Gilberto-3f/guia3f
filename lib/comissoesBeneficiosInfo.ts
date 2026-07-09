/** Largura fixa do tooltip — texto quebra naturalmente (menos cumprimento horizontal). */
export const LARGURA_POPUP_INFO_PX = 168

export type TipoBeneficioComissao =
  | 'pax'
  | 'percentual'
  | 'fixo'
  | 'extra'
  | 'extra_estacionamento'
  | 'extra_refeicao'
  | 'extra_voucher'
  | 'extra_outro'
  | 'percentual_diaria'
  | 'valor_fixo_diaria'

export type ChaveExtraComissao = 'estacionamento' | 'refeicao' | 'voucher' | 'outro'

export const CHAVES_EXTRA_COMISSAO = ['estacionamento', 'refeicao', 'voucher', 'outro'] as const

export const ROTULOS_EXTRA_COMISSAO: Record<ChaveExtraComissao, string> = {
  estacionamento: 'Estacionamento grátis',
  refeicao: 'Refeição almoço/jantar',
  voucher: 'Voucher',
  outro: 'Outro benefício',
}

export type ExtrasComissaoForm = Record<
  ChaveExtraComissao,
  ChaveExtraComissao extends 'outro' ? { ativo: boolean; texto: string } : { ativo: boolean }
>

export function criarExtrasComissaoVazio(): {
  estacionamento: { ativo: boolean }
  refeicao: { ativo: boolean }
  voucher: { ativo: boolean }
  outro: { ativo: boolean; texto: string }
} {
  return {
    estacionamento: { ativo: false },
    refeicao: { ativo: false },
    voucher: { ativo: false },
    outro: { ativo: false, texto: '' },
  }
}

export const INFO_BENEFICIO_TEXTO: Record<TipoBeneficioComissao, string> = {
  pax: 'Comissão paga por passageiro que trouxerem no local da empresa.',
  percentual:
    'Comissão paga sobre uma porcentagem da compra ou consumo do cliente na empresa.',
  fixo: 'Comissão de valor fixo por passageiro que consumir ou comprar na empresa.',
  extra:
    'Um benefício particular e personalizado que a empresa oferece além das comissões.',
  extra_estacionamento: 'Estacionamento gratuito para clientes indicados pela parceria.',
  extra_refeicao: 'Refeição (almoço ou jantar) oferecida como benefício da parceria.',
  extra_voucher: 'Voucher promocional oferecido junto à proposta de comissão.',
  extra_outro: 'Benefício personalizado descrito pela empresa.',
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

export type BeneficiosOfertaRecord = Record<
  string,
  { ativo?: boolean; valor?: number; texto?: string; por_tempo_limitado?: boolean } | boolean | undefined
>

export type ListarBeneficiosOpts = {
  /** Empresa do segmento Hospedagem — força leitura dos campos de diária. */
  segmentoHospedagem?: boolean
}

function objBeneficio(val: unknown): BeneficioValor | undefined {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return undefined
  return val as BeneficioValor
}

function temCamposBeneficioHospedagem(b: BeneficiosOfertaRecord): boolean {
  return Boolean(objBeneficio(b.percentual_diaria) || objBeneficio(b.valor_fixo_diaria))
}

export function isBeneficiosModoHospedagem(
  b: BeneficiosOfertaRecord,
  opts?: ListarBeneficiosOpts,
): boolean {
  if (b.modo_hospedagem === true) return true
  if (opts?.segmentoHospedagem) return true
  const pct = objBeneficio(b.percentual_diaria)
  const fixo = objBeneficio(b.valor_fixo_diaria)
  return Boolean(
    (pct && (pct.ativo === true || Number(pct.valor ?? 0) > 0)) ||
      (fixo && (fixo.ativo === true || Number(fixo.valor ?? 0) > 0)) ||
      temCamposBeneficioHospedagem(b),
  )
}

type BeneficioValor = { ativo?: boolean; valor?: number; texto?: string }

function beneficioComValor(obj: BeneficioValor | undefined, exigeTexto = false): boolean {
  if (!obj || typeof obj !== 'object') return false
  if (obj.ativo === true) return true
  if (exigeTexto) return String(obj.texto ?? '').trim().length > 0
  return Number(obj.valor ?? 0) > 0
}

function listarBeneficiosHospedagem(
  b: BeneficiosOfertaRecord,
  incluirInativos: boolean,
): { label: string; valor: string }[] {
  const itens: { label: string; valor: string }[] = []
  const pct = objBeneficio(b.percentual_diaria)
  const fixo = objBeneficio(b.valor_fixo_diaria)
  const aceita = incluirInativos
    ? (obj: BeneficioValor | undefined) => beneficioComValor(obj)
    : (obj: BeneficioValor | undefined) => obj?.ativo === true

  if (pct && aceita(pct)) {
    itens.push({
      label: ROTULOS_BENEFICIO.percentual_diaria,
      valor: `${pct.valor ?? 0}%`,
    })
  }
  if (fixo && aceita(fixo)) {
    itens.push({
      label: ROTULOS_BENEFICIO.valor_fixo_diaria,
      valor: `R$ ${fixo.valor ?? 0}`,
    })
  }
  return itens
}

function listarBeneficiosPadrao(
  b: BeneficiosOfertaRecord,
  incluirInativos: boolean,
): { label: string; valor: string }[] {
  const itens: { label: string; valor: string }[] = []
  const aceita = incluirInativos
    ? (obj: BeneficioValor | undefined, exigeTexto = false) => beneficioComValor(obj, exigeTexto)
    : (obj: BeneficioValor | undefined, exigeTexto = false) =>
        Boolean(
          obj &&
            (exigeTexto
              ? obj.ativo === true && String(obj.texto ?? '').trim()
              : obj.ativo === true),
        )

  const pax = objBeneficio(b.pax)
  const pct = objBeneficio(b.percentual)
  const fixo = objBeneficio(b.fixo)

  if (pax && aceita(pax)) {
    itens.push({ label: ROTULOS_BENEFICIO.pax, valor: `R$ ${pax.valor ?? 0}` })
  }
  if (pct && aceita(pct)) {
    itens.push({ label: ROTULOS_BENEFICIO.percentual, valor: `${pct.valor ?? 0}%` })
  }
  if (fixo && aceita(fixo)) {
    itens.push({ label: ROTULOS_BENEFICIO.fixo, valor: `R$ ${fixo.valor ?? 0}` })
  }

  /** Legado: campo único `extra` (propostas antigas). */
  const extra = objBeneficio(b.extra)
  if (extra && aceita(extra, true)) {
    itens.push({ label: ROTULOS_BENEFICIO.extra, valor: String(extra.texto).trim() })
  }

  const extrasRaw = b.extras
  if (extrasRaw && typeof extrasRaw === 'object' && !Array.isArray(extrasRaw)) {
    const extras = extrasRaw as Record<string, BeneficioValor | undefined>
    for (const key of CHAVES_EXTRA_COMISSAO) {
      if (key === 'outro') {
        const outro = objBeneficio(extras.outro)
        if (outro && aceita(outro, true)) {
          itens.push({
            label: ROTULOS_EXTRA_COMISSAO.outro,
            valor: String(outro.texto ?? '').trim(),
          })
        }
        continue
      }
      const item = objBeneficio(extras[key])
      if (item?.ativo === true) {
        itens.push({ label: ROTULOS_EXTRA_COMISSAO[key], valor: 'Incluso' })
      }
    }
  }

  return itens
}

/** Lista vertical de benefícios ativos para histórico / cards. */
export function listarBeneficiosOferta(
  b: BeneficiosOfertaRecord,
  opts?: ListarBeneficiosOpts,
): { label: string; valor: string }[] {
  if (isBeneficiosModoHospedagem(b, opts)) {
    return listarBeneficiosHospedagem(b, false)
  }
  return listarBeneficiosPadrao(b, false)
}

/** Histórico/arquivo ADM: exibe proposta mesmo se flags `ativo` foram desligadas após decisão. */
export function listarBeneficiosProposta(
  b: BeneficiosOfertaRecord,
  opts?: ListarBeneficiosOpts,
): { label: string; valor: string }[] {
  const ativos = listarBeneficiosOferta(b, opts)
  if (ativos.length > 0) return ativos

  if (isBeneficiosModoHospedagem(b, opts)) {
    const hospedagem = listarBeneficiosHospedagem(b, true)
    if (hospedagem.length > 0) return hospedagem
  }

  const padrao = listarBeneficiosPadrao(b, true)
  if (padrao.length > 0) return padrao

  return []
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

/** Tipo de info (tooltip) a partir do rótulo exibido na lista de benefícios. */
export function tipoInfoBeneficioPorRotulo(label: string): TipoBeneficioComissao {
  if (label === ROTULOS_BENEFICIO.pax) return 'pax'
  if (label === ROTULOS_BENEFICIO.percentual) return 'percentual'
  if (label === ROTULOS_BENEFICIO.fixo) return 'fixo'
  if (label === ROTULOS_BENEFICIO.extra) return 'extra'
  if (label === ROTULOS_BENEFICIO.percentual_diaria) return 'percentual_diaria'
  if (label === ROTULOS_BENEFICIO.valor_fixo_diaria) return 'valor_fixo_diaria'
  if (label === ROTULOS_EXTRA_COMISSAO.estacionamento) return 'extra_estacionamento'
  if (label === ROTULOS_EXTRA_COMISSAO.refeicao) return 'extra_refeicao'
  if (label === ROTULOS_EXTRA_COMISSAO.voucher) return 'extra_voucher'
  if (label === ROTULOS_EXTRA_COMISSAO.outro) return 'extra_outro'
  return 'extra'
}
