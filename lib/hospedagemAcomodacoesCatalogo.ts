/** Catálogo e tipos do CRUD de acomodações / políticas (hospedagem). */

export const COR_AZUL_LOGO = '#0097b2'
export const COR_VERDE_BOTAO = '#00D443'

/** Categorias de imóvel (escolha única). */
export const CATEGORIAS_IMOVEL = [
  { value: 'apartamento_quarto_particular', label: 'Apartamento (quarto particular)', tipo: 'particular' },
  { value: 'casa_quarto_particular', label: 'Casa (quarto particular)', tipo: 'particular' },
  { value: 'pousada_quarto_particular', label: 'Pousada (quarto particular)', tipo: 'particular' },
  { value: 'vila_quarto_particular', label: 'Vila (quarto particular)', tipo: 'particular' },
  { value: 'chale_quarto_particular', label: 'Chalé (quarto particular)', tipo: 'particular' },
  {
    value: 'casa_temporada',
    label: 'Casa (particular - aluguel por temporada)',
    tipo: 'particular',
  },
  {
    value: 'apartamento_temporada',
    label: 'Apartamento (particular - aluguel por temporada)',
    tipo: 'particular',
  },
  {
    value: 'kitnet_temporada',
    label: 'Kitnet (particular - aluguel por temporada)',
    tipo: 'particular',
  },
  {
    value: 'hostel_compartilhado',
    label: 'Hostel (quarto compartilhado com outras pessoas)',
    tipo: 'compartilhado',
  },
] as const

export type CategoriaImovelValue = (typeof CATEGORIAS_IMOVEL)[number]['value']
export type TipoAcomodacaoImovel = 'particular' | 'compartilhado'

export function tipoCategoriaImovel(value: string): TipoAcomodacaoImovel | null {
  const hit = CATEGORIAS_IMOVEL.find((c) => c.value === value)
  return hit?.tipo ?? null
}

export function rotuloCategoriaImovel(value: string | null | undefined): string {
  const hit = CATEGORIAS_IMOVEL.find((c) => c.value === value)
  return hit?.label ?? String(value ?? '')
}

/** Remove trecho auxiliar entre parênteses (ex.: "Kitnet (…)" → "Kitnet"). */
export function rotuloPrincipalSemParenteses(label: string | null | undefined): string {
  return String(label ?? '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function rotuloCategoriaImovelCurto(value: string | null | undefined): string {
  return rotuloPrincipalSemParenteses(rotuloCategoriaImovel(value))
}

export const CATEGORIAS_PARTICULAR = [
  { value: 'solteiro', label: 'Solteiro' },
  { value: 'casal', label: 'Casal (cama de casal para 1 ou 2 pessoas)' },
  { value: 'duplo', label: 'Duplo (2 cama de solteiro)' },
  { value: 'triplo', label: 'Triplo (3 solteiro)' },
  { value: 'triplo_familia', label: 'Triplo Família (1 cama de casal + 1 solteiro)' },
  { value: 'quadruplo', label: 'Quadruplo (4 solteiro)' },
  { value: 'quadruplo_familia', label: 'Quadruplo família (1 casal + 2 solteiro)' },
  { value: 'quintuplo', label: 'Quíntuplo (5 solteiro)' },
  { value: 'quintuplo_familia', label: 'Quíntuplo família (1 casal + 3 solteiro)' },
] as const

export type CategoriaParticularValue = (typeof CATEGORIAS_PARTICULAR)[number]['value']

export function rotuloCategoriaParticular(value: string | null | undefined): string {
  const hit = CATEGORIAS_PARTICULAR.find((c) => c.value === value)
  return hit?.label ?? String(value ?? '')
}

export const OPCOES_COMPARTILHADA = [
  { value: 'cama_solteiro', label: 'Cama de Solteiro' },
  { value: 'cama_solteiro_beliche', label: 'Cama de Solteiro (Beliche)' },
] as const

export type OpcaoCompartilhadaValue = (typeof OPCOES_COMPARTILHADA)[number]['value']

export function rotuloOpcaoCompartilhada(value: string | null | undefined): string {
  const hit = OPCOES_COMPARTILHADA.find((c) => c.value === value)
  return hit?.label ?? String(value ?? '')
}

export function rotuloCategoriaParticularCurto(value: string | null | undefined): string {
  return rotuloPrincipalSemParenteses(rotuloCategoriaParticular(value))
}

export function rotuloOpcaoCompartilhadaCurto(value: string | null | undefined): string {
  return rotuloPrincipalSemParenteses(rotuloOpcaoCompartilhada(value))
}

export type ComodidadesPadrao = {
  cafe_manha: boolean | null
  ar_condicionado: boolean | null
  wifi: boolean | null
  estacionamento: boolean | null
  banheiro: 'particular' | 'compartilhado' | null
  fumantes: 'livre' | 'proibido' | null
  lavanderia: boolean | null
  maleiro: boolean | null
  guarda_volumes: boolean | null
  servico_limpeza: boolean | null
  capacidade_maxima_hospedes: string
  pet_friendly: boolean | null
  pet_friendly_obs: string
}

export function comodidadesPadraoVazio(): ComodidadesPadrao {
  return {
    cafe_manha: null,
    ar_condicionado: null,
    wifi: null,
    estacionamento: null,
    banheiro: null,
    fumantes: null,
    lavanderia: null,
    maleiro: null,
    guarda_volumes: null,
    servico_limpeza: null,
    capacidade_maxima_hospedes: '',
    pet_friendly: null,
    pet_friendly_obs: '',
  }
}

export const COMODIDADES_PADRAO_CAMPOS: ReadonlyArray<{
  key: keyof ComodidadesPadrao
  label: string
  tipo: 'sim_nao' | 'banheiro' | 'fumantes' | 'texto' | 'pet'
}> = [
  { key: 'cafe_manha', label: 'Café da manhã', tipo: 'sim_nao' },
  { key: 'ar_condicionado', label: 'Ar-condicionado', tipo: 'sim_nao' },
  { key: 'wifi', label: 'Wi-Fi', tipo: 'sim_nao' },
  { key: 'estacionamento', label: 'Estacionamento', tipo: 'sim_nao' },
  { key: 'banheiro', label: 'Banheiro', tipo: 'banheiro' },
  { key: 'fumantes', label: 'Fumantes', tipo: 'fumantes' },
  { key: 'lavanderia', label: 'Lavanderia', tipo: 'sim_nao' },
  { key: 'maleiro', label: 'Maleiro', tipo: 'sim_nao' },
  { key: 'guarda_volumes', label: 'Guarda Volumes', tipo: 'sim_nao' },
  { key: 'servico_limpeza', label: 'Serviço de Limpeza', tipo: 'sim_nao' },
  { key: 'capacidade_maxima_hospedes', label: 'Capacidade máxima de hóspedes', tipo: 'texto' },
  { key: 'pet_friendly', label: 'Pet Friendly', tipo: 'pet' },
]

export const COMODIDADES_EXTRAS_LISTA = [
  { value: 'piscina_coberta', label: 'Piscina coberta' },
  { value: 'piscina_descoberta', label: 'Piscina descoberta' },
  { value: 'frigobar', label: 'Frigobar' },
  { value: 'churrasqueira', label: 'Churrasqueira' },
  { value: 'espaco_gourmet', label: 'Espaço Gourmet' },
  { value: 'cozinha_completa', label: 'Cozinha completa' },
  { value: 'geladeira_compartilhada', label: 'Geladeira compartilhada' },
  { value: 'salao_festas', label: 'Salão de festas' },
  { value: 'espaco_kids', label: 'Espaço Kids' },
  { value: 'aquecedor', label: 'Aquecedor' },
  { value: 'academia', label: 'Academia' },
  { value: 'cofre', label: 'Cofre' },
] as const

export const ITENS_PARTICULARES = [
  { value: 'sabonete', label: 'Sabonete' },
  { value: 'shampoo', label: 'Shampoo' },
  { value: 'papel_higienico', label: 'Papel higiênico' },
  { value: 'pasta_dente', label: 'Pasta de dente' },
  { value: 'toalhas', label: 'Toalhas' },
] as const

export const REFEICOES_EXTRAS = [
  { value: 'cafe_tarde', label: 'Café da tarde' },
  { value: 'almoco', label: 'Almoço' },
  { value: 'jantar', label: 'Jantar' },
] as const

export type ComodidadesExtras = {
  selecionados: string[]
  itens_particulares: string[]
  refeicoes_extras: string[]
  outros: string
}

export function comodidadesExtrasVazio(): ComodidadesExtras {
  return {
    selecionados: [],
    itens_particulares: [],
    refeicoes_extras: [],
    outros: '',
  }
}

export type FormasPagamentoHospedagem = {
  dinheiro: boolean
  moedas: string[]
  pix: boolean
  cartao_credito: boolean
  cartao_debito: boolean
}

export function formasPagamentoVazio(): FormasPagamentoHospedagem {
  return {
    dinheiro: false,
    moedas: [],
    pix: false,
    cartao_credito: false,
    cartao_debito: false,
  }
}

export const MOEDAS_DINHEIRO = [
  { value: 'real', label: 'Real' },
  { value: 'dolar', label: 'Dólar' },
  { value: 'guarani', label: 'Guaraní' },
  { value: 'peso', label: 'Peso' },
  { value: 'euro', label: 'Euro' },
] as const

export type HospedagemAcomodacaoRow = {
  id: string
  empresa_id: string
  categoria_imovel: string
  categoria_particular: string | null
  opcao_compartilhada: string | null
  capacidade_pessoas: number
  valor_diaria: number
  fotos: string[]
  comodidades_padrao: ComodidadesPadrao
  comodidades_extras: ComodidadesExtras
  ativo: boolean
  site_url: string | null
  created_at?: string
  updated_at?: string
}

export function mapAcomodacaoRow(raw: Record<string, unknown>): HospedagemAcomodacaoRow {
  return {
    id: String(raw.id),
    empresa_id: String(raw.empresa_id),
    categoria_imovel: String(raw.categoria_imovel),
    categoria_particular: raw.categoria_particular != null ? String(raw.categoria_particular) : null,
    opcao_compartilhada: raw.opcao_compartilhada != null ? String(raw.opcao_compartilhada) : null,
    capacidade_pessoas: Number(raw.capacidade_pessoas) || 1,
    valor_diaria: Number(raw.valor_diaria) || 0,
    fotos: Array.isArray(raw.fotos) ? raw.fotos.map(String) : [],
    comodidades_padrao: parseComodidadesPadrao(raw.comodidades_padrao),
    comodidades_extras: parseComodidadesExtras(raw.comodidades_extras),
    ativo: raw.ativo == null ? true : Boolean(raw.ativo),
    site_url:
      raw.site_url != null && String(raw.site_url).trim() !== '' ? String(raw.site_url).trim() : null,
    created_at: raw.created_at != null ? String(raw.created_at) : undefined,
    updated_at: raw.updated_at != null ? String(raw.updated_at) : undefined,
  }
}

export type HospedagemPoliticasRow = {
  empresa_id: string
  checkin_hora: string
  checkout_hora: string
  caucao_exige: boolean
  caucao_diarias: number | null
  cancelamento_gratuito: boolean
  cancelamento_dias_antes: number | null
  cancelamento_descricao: string
  restricao_idade: boolean
  restricao_idade_obs: string | null
  formas_pagamento: FormasPagamentoHospedagem
  updated_at?: string
}

export function parseComodidadesPadrao(raw: unknown): ComodidadesPadrao {
  const base = comodidadesPadraoVazio()
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  return {
    cafe_manha: typeof o.cafe_manha === 'boolean' ? o.cafe_manha : null,
    ar_condicionado: typeof o.ar_condicionado === 'boolean' ? o.ar_condicionado : null,
    wifi: typeof o.wifi === 'boolean' ? o.wifi : null,
    estacionamento: typeof o.estacionamento === 'boolean' ? o.estacionamento : null,
    banheiro: o.banheiro === 'particular' || o.banheiro === 'compartilhado' ? o.banheiro : null,
    fumantes: o.fumantes === 'livre' || o.fumantes === 'proibido' ? o.fumantes : null,
    lavanderia: typeof o.lavanderia === 'boolean' ? o.lavanderia : null,
    maleiro: typeof o.maleiro === 'boolean' ? o.maleiro : null,
    guarda_volumes: typeof o.guarda_volumes === 'boolean' ? o.guarda_volumes : null,
    servico_limpeza: typeof o.servico_limpeza === 'boolean' ? o.servico_limpeza : null,
    capacidade_maxima_hospedes:
      o.capacidade_maxima_hospedes != null ? String(o.capacidade_maxima_hospedes) : '',
    pet_friendly: typeof o.pet_friendly === 'boolean' ? o.pet_friendly : null,
    pet_friendly_obs: o.pet_friendly_obs != null ? String(o.pet_friendly_obs) : '',
  }
}

export function parseComodidadesExtras(raw: unknown): ComodidadesExtras {
  const base = comodidadesExtrasVazio()
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  return {
    selecionados: Array.isArray(o.selecionados) ? o.selecionados.map(String) : [],
    itens_particulares: Array.isArray(o.itens_particulares)
      ? o.itens_particulares.map(String)
      : [],
    refeicoes_extras: Array.isArray(o.refeicoes_extras) ? o.refeicoes_extras.map(String) : [],
    outros: o.outros != null ? String(o.outros).slice(0, 500) : '',
  }
}

export function parseFormasPagamento(raw: unknown): FormasPagamentoHospedagem {
  const base = formasPagamentoVazio()
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  return {
    dinheiro: Boolean(o.dinheiro),
    moedas: Array.isArray(o.moedas) ? o.moedas.map(String) : [],
    pix: Boolean(o.pix),
    cartao_credito: Boolean(o.cartao_credito),
    cartao_debito: Boolean(o.cartao_debito),
  }
}

export function validarComodidadesPadrao(c: ComodidadesPadrao): string | null {
  for (const campo of COMODIDADES_PADRAO_CAMPOS) {
    if (campo.tipo === 'texto') {
      if (!String(c.capacidade_maxima_hospedes ?? '').trim()) {
        return `Faltou preencher o campo "${campo.label}"`
      }
      continue
    }
    if (campo.tipo === 'pet') {
      if (c.pet_friendly === null) return `Faltou preencher o campo "${campo.label}"`
      continue
    }
    const v = c[campo.key]
    if (v === null || v === undefined || v === '') {
      return `Faltou preencher o campo "${campo.label}"`
    }
  }
  return null
}

export function validarFormasPagamento(f: FormasPagamentoHospedagem): string | null {
  if (!f.dinheiro && !f.pix && !f.cartao_credito && !f.cartao_debito) {
    return 'Selecione ao menos uma forma de pagamento.'
  }
  if (f.dinheiro && f.moedas.length === 0) {
    return 'Selecione ao menos uma moeda para pagamento em dinheiro.'
  }
  return null
}

export function rotuloAcomodacaoResumo(row: {
  categoria_imovel: string
  categoria_particular?: string | null
  opcao_compartilhada?: string | null
}): string {
  const tipo = tipoCategoriaImovel(row.categoria_imovel)
  const base = rotuloCategoriaImovel(row.categoria_imovel)
  if (tipo === 'particular' && row.categoria_particular) {
    return `${base} · ${rotuloCategoriaParticular(row.categoria_particular)}`
  }
  if (tipo === 'compartilhado' && row.opcao_compartilhada) {
    return `${base} · ${rotuloOpcaoCompartilhada(row.opcao_compartilhada)}`
  }
  return base
}

/** Resumo limpo: só nomes principais, sem auxiliares entre parênteses. */
export function rotuloAcomodacaoResumoCurto(row: {
  categoria_imovel: string
  categoria_particular?: string | null
  opcao_compartilhada?: string | null
}): string {
  const tipo = tipoCategoriaImovel(row.categoria_imovel)
  const base = rotuloCategoriaImovelCurto(row.categoria_imovel)
  if (tipo === 'particular' && row.categoria_particular) {
    return `${base} · ${rotuloCategoriaParticularCurto(row.categoria_particular)}`
  }
  if (tipo === 'compartilhado' && row.opcao_compartilhada) {
    return `${base} · ${rotuloOpcaoCompartilhadaCurto(row.opcao_compartilhada)}`
  }
  return base
}

export function formatarValorDiaria(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
