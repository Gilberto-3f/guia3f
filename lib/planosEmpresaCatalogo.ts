export type PlanoCorId = 'azul' | 'verde' | 'preto' | 'roxo'

export type ServicoPlanoId =
  | 'pagina_rede_social'
  | 'botao_dinamico'
  | 'botao_chamar_corrida'
  | 'canais'
  | 'dashboard_empresa'
  | 'estatisticas_mercado'
  | 'compras_paraguai_drena'
  | 'publicidade'
  | 'planejador_publicacoes'
  | 'auxiliar_adm'

export const CORES_PLANO: { id: PlanoCorId; hex: string; label: string }[] = [
  { id: 'azul', hex: '#0097b2', label: 'Azul' },
  { id: 'verde', hex: '#00D443', label: 'Verde' },
  { id: 'preto', hex: '#111827', label: 'Preto' },
  { id: 'roxo', hex: '#7C3AED', label: 'Roxo' },
]

/** Todos os serviços (ex.: modo anfitrião). Degustação usa apenas servicos do plano bonificado. */
export const TODOS_SERVICOS_EMPRESA: ServicoPlanoId[] = [
  'pagina_rede_social',
  'botao_dinamico',
  'botao_chamar_corrida',
  'canais',
  'dashboard_empresa',
  'estatisticas_mercado',
  'compras_paraguai_drena',
  'publicidade',
  'planejador_publicacoes',
  'auxiliar_adm',
]

export const SERVICOS_PLANO_EMPRESA: { id: ServicoPlanoId; label: string }[] = [
  {
    id: 'pagina_rede_social',
    label:
      'Página da Empresa + Rede Social: Guia Turístico, Menu Lateral (empresa), Atividades e Publicações (no Feed + Storys pelo menu lateral).',
  },
  {
    id: 'botao_dinamico',
    label:
      'Botão Dinâmico (do card da página de filtros + aba da página da empresa): para a empresa cadastrar seu sistema de vendas particular ou seu WhatsApp no Guia Turístico.',
  },
  {
    id: 'botao_chamar_corrida',
    label:
      'Botão Chamar Corrida: botão presente na aba Endereço da página da empresa, onde vamos cadastrar um alfinete no mapa da mobilidade para mostrar e oferecer o endereço da empresa como um dos destinos finais do app.',
  },
  {
    id: 'canais',
    label: 'Canais: Canais de comunicação com as comunidades de profissionais.',
  },
  {
    id: 'dashboard_empresa',
    label: 'Dashboard Empresa: Para monitoramento do desempenho do ecossistema junto a empresa.',
  },
  {
    id: 'estatisticas_mercado',
    label:
      'Estatísticas de Mercado: para analise do desempenho geral do trabalho do aplicativo, onde convertemos nossos dados em estatísticas.',
  },
  {
    id: 'compras_paraguai_drena',
    label: 'Compras Paraguai + Drena Stok: analíticos desenvolvidos exclusivamente para clientes de CDE.',
  },
  {
    id: 'publicidade',
    label:
      'Serviços de Publicidade: Destaque na Home do APP + Publicidade Móvel (interna e externa, feitas em parcerias com profissionais da região).',
  },
  {
    id: 'planejador_publicacoes',
    label: 'Planejador de Publicações: Para o usuário organizar suas publicações das redes sociais.',
  },
  {
    id: 'auxiliar_adm',
    label: 'Auxiliar ADM: trabalho de um profissional particular auxiliando nos trabalhos da plataforma.',
  },
]

export function corPlanoHex(cor: PlanoCorId | string | null | undefined): string {
  return CORES_PLANO.find((c) => c.id === cor)?.hex ?? '#0097b2'
}

export function labelServicoPlano(id: ServicoPlanoId | string): string {
  return SERVICOS_PLANO_EMPRESA.find((s) => s.id === id)?.label ?? id
}

export function slugPlanoNome(titulo: string): string {
  const base = titulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
  const sufixo = Date.now().toString(36).slice(-5)
  return base ? `${base}-${sufixo}` : `plano-${sufixo}`
}
