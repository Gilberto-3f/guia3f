export type Periodo = 'hoje' | '7d' | '30d' | '90d'

export interface DadosFunil {
  visualizacoes: number
  interacoes: number
  recomendacoes: number
  pax: number
  vendas: number
}

export interface RecomendacaoDetalhe {
  id: string
  created_at: string
  turista_canal: 'whatsapp' | 'email' | null
  turista_whatsapp_final: string | null
  turista_whatsapp_ddd: string | null
  turista_email_prefix: string | null
}

export interface RecomendacaoProfissional {
  profissional_id: string
  profissional_nome: string
  profissional_username: string
  profissional_foto_url: string | null
  profissional_verificado?: boolean
  categoria: string
  total: number
  detalhes: RecomendacaoDetalhe[]
}

/** Detalhe de recomendação indireta (produto do catálogo). */
export interface RecomendacaoProdutoDetalhe extends RecomendacaoDetalhe {
  produto_id: string
  produto_nome: string
  produto_foto_url: string | null
}

export interface RecomendacaoProdutoProfissional {
  profissional_id: string
  profissional_nome: string
  profissional_username: string
  profissional_foto_url: string | null
  profissional_verificado?: boolean
  categoria: string
  total: number
  detalhes: RecomendacaoProdutoDetalhe[]
}

/** Detalhe de recomendação indireta (prato do cardápio digital / gastronomia). */
export interface RecomendacaoPratoDetalhe extends RecomendacaoDetalhe {
  prato_id: string
  prato_nome: string
  prato_foto_url: string | null
}

export interface RecomendacaoPratoProfissional {
  profissional_id: string
  profissional_nome: string
  profissional_username: string
  profissional_foto_url: string | null
  profissional_verificado?: boolean
  categoria: string
  total: number
  detalhes: RecomendacaoPratoDetalhe[]
}

/** Detalhe de recomendação indireta (serviço local). */
export interface RecomendacaoServicoDetalhe extends RecomendacaoDetalhe {
  servico_id: string
  servico_nome: string
  servico_foto_url: string | null
}

export interface RecomendacaoServicoProfissional {
  profissional_id: string
  profissional_nome: string
  profissional_username: string
  profissional_foto_url: string | null
  profissional_verificado?: boolean
  categoria: string
  total: number
  detalhes: RecomendacaoServicoDetalhe[]
}

/** Detalhe de recomendação indireta (ticket / atrativo). */
export interface RecomendacaoTicketDetalhe extends RecomendacaoDetalhe {
  experiencia_id: string
  experiencia_nome: string
  experiencia_foto_url: string | null
}

export interface RecomendacaoTicketProfissional {
  profissional_id: string
  profissional_nome: string
  profissional_username: string
  profissional_foto_url: string | null
  profissional_verificado?: boolean
  categoria: string
  total: number
  detalhes: RecomendacaoTicketDetalhe[]
}

export interface PaxDetalhe {
  id: string
  created_at: string
  pax_qtd: number
}

export interface PaxProfissional {
  profissional_id: string
  profissional_nome: string
  profissional_username: string
  profissional_foto_url: string | null
  profissional_verificado?: boolean
  categoria: string
  total: number
  detalhes: PaxDetalhe[]
}

export interface VendaDetalhe {
  id: string
  created_at: string
  valor: number | null
}

export interface VendaProfissional {
  profissional_id: string
  profissional_nome: string
  profissional_username: string
  profissional_foto_url: string | null
  profissional_verificado?: boolean
  categoria: string
  total: number
  detalhes: VendaDetalhe[]
}

export interface DadosSegmentosGuia {
  categoria: string
  total: number
  percentual: number
}

export interface DadosSegmentosRecomendados {
  segmento: string
  total: number
  percentual: number
}

export interface DadosAtendimentosCategoria {
  categoria: string
  total: number
  percentual: number
}

export interface DadosDistribuicaoProfissionais {
  tipo: string
  cidade: string
  total: number
}

export interface DadosComissaoRamo {
  ramo: string
  media: number
  sua_comissao: number
}

export interface ComissaoSegmentoMercado {
  segmento: string
  label: string
  mediaPax: number
  mediaPercentual: number
  mediaIndicacao: number
  quantidade: number
}

export interface ContagemSegmentoMercado {
  segmento: string
  label: string
  total: number
  percentual: number
}

export interface AnaliseMercadoPainel {
  visibilidade: ContagemSegmentoMercado[]
  engajamento: ContagemSegmentoMercado[]
  recomendados: ContagemSegmentoMercado[]
  comissao: ComissaoSegmentoMercado[]
  comissaoEmpresa: {
    mediaPax: number
    mediaPercentual: number
    mediaIndicacao: number
    quantidade: number
  }
}

export interface DadosCrescimentoUsuarios {
  mes: string
  turistas: number
  profissionais: number
  empresas: number
}

export interface DadosOcupacaoHoteleira {
  mes: string
  ocupacao: number
}

export interface ReservaHospedagemRow {
  dataCheckin: string
  dataCheckout: string
  status: string
}

export interface AtendimentoProjecaoRow {
  categoria: string
  cidades: string[]
  createdAt: string
  status: string
  tipoServico: string
  dataAgendada: string | null
  latOrigem: number | null
  lngOrigem: number | null
  latDestino: number | null
  lngDestino: number | null
  regiao: string | null
}

export interface DadosHorariosPico {
  hora: number
  total: number
}

export interface DadosFunilEcossistema {
  recomendacoes: number
  pax: number
  vendas: number
}

export interface RecomendacaoCategoriaAgregada {
  categoria: string
  total: number
}

export interface DadosHistoricoAtendimentos {
  mes: string
  valor: number
}

export interface Produto {
  id: string
  nome: string
  descricao: string | null
  categoria_drena: string
  marca: string | null
  preco_brl: number | null
  foto_url: string | null
}

export interface ProdutoRanking {
  id: string
  nome: string
  categoria_drena: string
  marca: string | null
  total_buscas: number
  variacao: number
}

export interface MarcaRanking {
  marca: string
  principal_produto: string
  total_buscas: number
  variacao: number
}

export interface SegmentoAlta {
  segmento: string
  percentual: number
  total_buscas: number
}

export interface Tendencia {
  nome: string
  crescimento: number
  buscas: number
}

