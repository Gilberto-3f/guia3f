export type MenuEmpresaTab = 'publicidade' | 'chat-adm' | 'denuncias' | 'compras-paraguai' | 'planos'

export interface Anuncio {
  id: string
  tipo: 'home' | 'feed'
  localizacao: string | null
  imagem_url: string
  link_url: string | null
  periodo_inicio: string
  periodo_fim: string
  impressoes_contratadas: number | null
  impressoes_exibidas: number
  cliques: number
  status: string
}

export interface ReservaAnuncio {
  id: string
  vaga: string
  periodo_inicio: string
  periodo_fim: string
  status: string
}

export interface MensagemChatAdm {
  id: string
  admin_id: string | null
  admin_email?: string | null
  mensagem: string
  lida_empresa: boolean
  created_at: string
}

