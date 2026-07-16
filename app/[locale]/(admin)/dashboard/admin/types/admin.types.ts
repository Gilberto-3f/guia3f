export type AdminRoleBase = 'admin'

/** 0 = sem cargo ADM; 1–4 = níveis em `usuarios.admin_level` (geral, moderador, financeiro, suporte). */
export type AdminNivel = 0 | 1 | 2 | 3 | 4

export type AdminPermissoes = {
  verificacao?: {
    turistas?: boolean
    profissionais?: boolean
    empresas?: boolean
  }
  denuncias?: {
    turistas?: boolean
    profissionais?: boolean
    empresas?: boolean
  }
  espacoAdm?: {
    graficos?: boolean
    empresas?: boolean
    financeiro?: boolean
    gerencia?: boolean
  }
  configuracoes?: {
    apis?: boolean
    logs?: boolean
    geral?: boolean
    seguranca?: boolean
  }
}

export type AdminUser = {
  id: string
  username?: string | null
  email?: string | null
  role: AdminRoleBase
  admin_level: AdminNivel
  admin_permissoes: AdminPermissoes
}

export type Periodo = '7d' | '30d' | '90d' | '12m'
export type PerfilVisaoGeral = 'turistas' | 'profissionais' | 'empresas'

export type FiltrosVisaoGeral = {
  periodo: Periodo
}

export type DadoCrescimento = {
  mes: string
  total: number
}

export type DadoAtivo = {
  status: 'ativo' | 'offline'
  total: number
}

export type DadoPizzaSegmento = {
  label: string
  valor: number
  percentual: number
  cor?: string
}

export type DadoRosca = {
  atual: number
  anterior: number
  variacao: number
}

export type DadoBarras = {
  label: string
  total: number
}

export type TopoCardResumo = {
  total: number
  variacao: number
}

export type DadosTopoCards = {
  turistas: TopoCardResumo
  profissionais: TopoCardResumo
  empresas: TopoCardResumo
}

export type PerfilVerificacao = 'turistas' | 'profissionais' | 'empresas'

export type PeriodoVerificacao = 'hoje' | '7d' | '30d'

export type PendenteTurista = {
  id: string
  usuario_id: string
  nome_completo: string
  nome_usuario: string
  foto_url: string | null
  documento_frente_url: string | null
  documento_verso_url: string | null
  documento_identidade?: string | null
  docs_verificado: boolean
  docs_verificado_por: string | null
  docs_verificado_em: string | null
  created_at: string
  /** E-mail do `usuarios` (enriquecido na listagem admin). */
  email?: string | null
  whatsapp?: string | null
  telefone?: string | null
  /** Histórico de pré-liberação para análise do ADM. */
  pre_liberacoes?: Record<string, unknown>[]
}

export type PendenteProfissional = {
  id: string
  usuario_id: string
  nome_completo: string
  nome_usuario: string
  foto_url: string | null
  categorias: string[]
  placa_vermelha: boolean
  /** Coluna direta (novo fluxo); compatível com `documentos.identidade_url`. */
  documento_frente_url?: string | null
  documento_identidade?: string | null
  documentos: {
    identidade_url: string
    documento_verso_url: string
    comprovante_residencia_url: string
    comprovante_profissao_url: string
  }
  docs_verificado: boolean
  docs_verificado_por: string | null
  docs_verificado_em: string | null
  created_at: string
  email?: string | null
  whatsapp?: string | null
  telefone?: string | null
  pais?: string | null
  cidade_atuacao?: string[] | null
}

export type PendenteEmpresa = {
  id: string
  usuario_id: string
  nome_fantasia: string
  nome_usuario: string
  categoria: string
  cidade: string
  documento_frente_url?: string | null
  documento_verso_url?: string | null
  comprovante_residencia_url?: string | null
  documento_url: string | null
  /** URL bruta do comercial (quando distinta de `documento_url`). */
  documento_comercial_url?: string | null
  fotos_url: string[]
  docs_verificado: boolean
  docs_verificado_por: string | null
  docs_verificado_em: string | null
  created_at: string
  email?: string | null
  telefone?: string | null
  whatsapp?: string | null
  /** `empresas.status` (ex.: aguardando_aprovacao, aprovado). */
  status?: string | null
  /** CNPJ, RUC ou CUIT informado no cadastro. */
  documento_fiscal?: string | null
}

export type PendenteVerificacao = PendenteTurista | PendenteProfissional | PendenteEmpresa

export type ContadoresVerificacao = {
  turistas: number
  profissionais: number
  empresas: number
}

export type ContadoresExclusaoCadastro = {
  turistas: number
  profissionais: number
  empresas: number
}

export type SolicitacaoPerfilTipo = 'turista' | 'profissional' | 'empresa'
export type SolicitacaoStatus = 'pendente' | 'aprovado' | 'recusado' | 'revogado' | 'expirado'

export type SolicitacaoAcesso = {
  id: string
  solicitante_id: string
  solicitante_email: string
  solicitante_nome: string
  perfil_tipo: SolicitacaoPerfilTipo
  perfil_id: string
  perfil_nome: string
  perfil_username: string
  motivo: string | null
  status: SolicitacaoStatus
  aprovado_por: string | null
  aprovado_por_email: string | null
  aprovado_em: string | null
  recusado_por: string | null
  recusado_por_email: string | null
  recusado_em: string | null
  motivo_recusa: string | null
  revogado_por: string | null
  revogado_por_email: string | null
  revogado_em: string | null
  motivo_revogacao: string | null
  conceder_acesso_ate: string | null
  created_at: string
}

export type AprovarSolicitacaoParams = {
  solicitacao_id: string
  conceder_acesso_ate?: Date
}

export type RecusarSolicitacaoParams = {
  solicitacao_id: string
  motivo: string
}

export type RevogarAcessoParams = {
  solicitacao_id: string
  motivo: string
}

export type DenunciaStatus = 'pendente' | 'em_investigacao' | 'encerrada' | 'arquivada'
export type DenunciaGravidade = 'leve' | 'media' | 'grave' | 'gravissima'
export type DenunciaPenalidade = 'advertencia' | 'suspensao' | 'banimento'
export type DenunciaPerfil = 'turistas' | 'profissionais' | 'empresas' | 'auditoria'
export type ConteudoDenunciaTipo = 'post' | 'comentario' | 'story' | 'avaliacao'
export type MedidaDenunciaTipo =
  | 'improcedente'
  | 'mensagem'
  | 'bloqueio'
  | 'excluir_conteudo'
  | 'excluir_cadastro'

export type Denuncia = {
  id: string
  denunciante_id: string
  denunciante_email: string
  denunciante_nome: string
  denunciado_id: string
  denunciado_tipo: 'turista' | 'profissional' | 'empresa' | 'story'
  denunciado_usuario_id?: string | null
  conteudo_tipo?: ConteudoDenunciaTipo | null
  conteudo_id?: string | null
  medida_aplicada?: boolean
  medida_tipo?: MedidaDenunciaTipo | string | null
  denunciado_email: string
  denunciado_nome: string
  denunciado_username: string
  /** Categoria do profissional denunciado (ex.: Guias de Turismo). */
  denunciado_categoria?: string | null
  /** Mídia do story (quando `denunciado_tipo === 'story'`). */
  story_conteudo_url?: string | null
  story_autor_usuario_id?: string | null
  motivo: string
  descricao: string | null
  evidencias: string[]
  status: DenunciaStatus
  gravidade: DenunciaGravidade | null
  responsavel_id: string | null
  responsavel_email: string | null
  analisado_em: string | null
  analisado_por: string | null
  penalidade_aplicada: DenunciaPenalidade | null
  penalidade_detalhes: {
    dias?: number
    motivo?: string
    prazo_reenvio?: number
  } | null
  prazo_analise_ate?: string | null
  prazo_estourado?: boolean
  total_denuncias_anteriores?: number
  created_at: string
  updated_at: string
}

export type AplicarPenalidadeParams = {
  denuncia_id: string
  acao: 'advertir' | 'suspender' | 'banir'
  suspensao_dias?: number
  motivo: string
}

export type DenunciasFiltros = {
  perfil: DenunciaPerfil
  status: DenunciaStatus | 'todas'
  busca: string
  categoria?: string
}

export type AplicarMedidaDenunciaParams = {
  denuncia_id: string
  medida: MedidaDenunciaTipo
  texto?: string
}

// ================================
// Espaço ADM — Gerência (permissões)
// ================================

export type AdminCargo = 'ADM_GERAL' | 'MODERADOR' | 'FINANCEIRO' | 'SUPORTE'

export type AdminPermissoesGranulares = {
  comunidade?: string | null
  modulos?: string[]
  recursos?: string[]
}

// ================================
// Espaço ADM — Empresas (funil)
// ================================

export type FunilPeriodo = '7d' | '30d' | '90d'

export type DadosFunil = {
  empresa_id: string
  empresa_nome: string
  visualizacoes: number
  seguidores: number
  recomendacoes: number
  pax: number
  vendas: number
  conversao_seguidores: number
  conversao_recomendacoes: number
  conversao_pax: number
  conversao_vendas: number
}

// ================================
// Configurações (Dashboard Admin)
// ================================

export type ConfigAmbienteAPI = 'teste' | 'producao'

export type CotacaoModoConfig = 'api' | 'manual'

export type ConfigAPIs = {
  id?: string
  gateway: string
  chave_publica: string
  chave_secreta: string
  webhook_secret: string
  ambiente: ConfigAmbienteAPI
  moedas: string[]
  api_mobilidade_url: string
  api_mobilidade_key: string
  cotacoes_modo: CotacaoModoConfig
  cotacoes_fonte_url: string
  cotacoes_manual: Record<string, number>
  cotacoes_sync_em?: string | null
}

export type ConfigGeral = {
  id?: string
  politicas_privacidade: string
  termos_uso: string
  regras_ecossistema: string
  prazo_pre_aprovacao_turista: number
  prazo_verificacao_documentos: number
  limite_fotos_empresa: number
  limite_reservas_ativas: number
  tempo_pagamento_reserva: number
}

