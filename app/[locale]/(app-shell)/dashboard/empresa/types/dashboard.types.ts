export type Periodo = 'hoje' | '7d' | '30d' | '90d'

export interface DadosFunil {
  visualizacoes: number
  seguidores: number
  recomendacoes: number
  pax: number
  vendas: number
}

export interface RecomendacaoProfissional {
  profissional_id: string
  profissional_nome: string
  profissional_username: string
  categoria: string
  total: number
}

export interface PaxProfissional {
  profissional_id: string
  profissional_nome: string
  profissional_username: string
  total: number
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

export interface DadosHorariosPico {
  hora: number
  total: number
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

