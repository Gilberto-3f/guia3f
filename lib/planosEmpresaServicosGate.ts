import type { ServicoPlanoId } from '@/lib/planosEmpresaCatalogo'

export type MenuEmpresaId =
  | 'feed-stories'
  | 'cadastrar-comissao'
  | 'publicidade'
  | 'chat-adm'
  | 'denuncias'
  | 'compras-paraguai'

export type AbaDashboardEmpresa = 'funil' | 'mercado' | 'drena'

export type FeatureEmpresaId =
  | 'pagina_rede_social'
  | 'botao_dinamico'
  | 'botao_chamar_corrida'
  | 'canais'
  | 'planejador_publicacoes'
  | 'publicidade'

export const AVISO_PLANO_EMPRESA_PADRAO =
  'Este recurso depende do plano contratado. Confira os planos disponíveis no canal Financeiro.'

export type PlanoResumoServicos = {
  id?: string
  nome: string
  titulo: string
  servicos: ServicoPlanoId[]
}

const MENU_SERVICO: Record<MenuEmpresaId, ServicoPlanoId | null> = {
  'feed-stories': 'pagina_rede_social',
  'cadastrar-comissao': 'pagina_rede_social',
  publicidade: 'publicidade',
  'chat-adm': 'pagina_rede_social',
  denuncias: null,
  'compras-paraguai': 'compras_paraguai_drena',
}

/** Rede Social e Publicidade: visíveis com qualquer plano contratado ou degustação ativa. */
const MENU_COM_PLANO_OU_DEGUSTACAO: MenuEmpresaId[] = ['feed-stories', 'publicidade']

const FEATURE_SERVICO: Record<FeatureEmpresaId, ServicoPlanoId> = {
  pagina_rede_social: 'pagina_rede_social',
  botao_dinamico: 'botao_dinamico',
  botao_chamar_corrida: 'botao_chamar_corrida',
  canais: 'canais',
  planejador_publicacoes: 'planejador_publicacoes',
  publicidade: 'publicidade',
}

const ABA_SERVICO: Record<AbaDashboardEmpresa, ServicoPlanoId> = {
  funil: 'dashboard_empresa',
  mercado: 'estatisticas_mercado',
  drena: 'compras_paraguai_drena',
}

export function normalizarPlanoSlug(plano: string): string {
  return plano
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function empresaTemServico(servicos: readonly string[], servico: ServicoPlanoId): boolean {
  return servicos.includes(servico)
}

/** Plano reconhecido no catálogo ou degustação ativa (lista de serviços resolvida não vazia). */
export function empresaPlanoOuDegustacaoAtivo(servicos: readonly string[]): boolean {
  return servicos.length > 0
}

export function menuEmpresaLiberado(menuId: MenuEmpresaId, servicos: readonly string[]): boolean {
  if (MENU_COM_PLANO_OU_DEGUSTACAO.includes(menuId)) {
    return empresaPlanoOuDegustacaoAtivo(servicos)
  }
  const servico = MENU_SERVICO[menuId]
  if (servico === null) return true
  return empresaTemServico(servicos, servico)
}

export function abaDashboardLiberada(aba: AbaDashboardEmpresa, servicos: readonly string[]): boolean {
  return empresaTemServico(servicos, ABA_SERVICO[aba])
}

export function featureEmpresaLiberada(feature: FeatureEmpresaId, servicos: readonly string[]): boolean {
  return empresaTemServico(servicos, FEATURE_SERVICO[feature])
}

export function resolverServicosDoPlano(
  planoEmpresa: string | null | undefined,
  planos: PlanoResumoServicos[],
): ServicoPlanoId[] {
  const p = normalizarPlanoSlug(planoEmpresa ?? '')
  if (!p || p === 'gratuito') return []

  const match = planos.find(
    (item) => normalizarPlanoSlug(item.nome) === p || normalizarPlanoSlug(item.titulo) === p,
  )
  return match?.servicos ?? []
}

export function servicosPlanoBasico(planos: PlanoResumoServicos[]): ServicoPlanoId[] {
  const basico = planos.find((item) => {
    const nome = normalizarPlanoSlug(item.nome)
    const titulo = normalizarPlanoSlug(item.titulo)
    return nome === 'basico' || titulo === 'basico'
  })
  return basico?.servicos?.length ? basico.servicos : ['pagina_rede_social']
}

export type DegustacaoServicosOpts = {
  ativa: boolean
  servicos?: ServicoPlanoId[] | null
}

export function resolverServicosEmpresa(
  planoEmpresa: string | null | undefined,
  planos: PlanoResumoServicos[],
  degustacao: boolean | DegustacaoServicosOpts,
): ServicoPlanoId[] {
  const opts: DegustacaoServicosOpts =
    typeof degustacao === 'boolean' ? { ativa: degustacao } : degustacao

  if (opts.ativa) {
    if (opts.servicos?.length) return [...opts.servicos]
    return servicosPlanoBasico(planos)
  }
  return resolverServicosDoPlano(planoEmpresa, planos)
}

/** Plano contratado reconhecido no catálogo ativo (evita exibir slug órfão legado). */
export function planoEmpresaReconhecidoNoCatalogo(
  planoEmpresa: string | null | undefined,
  planos: PlanoResumoServicos[],
): PlanoResumoServicos | null {
  const p = normalizarPlanoSlug(planoEmpresa ?? '')
  if (!p || p === 'gratuito') return null
  return (
    planos.find(
      (item) => normalizarPlanoSlug(item.nome) === p || normalizarPlanoSlug(item.titulo) === p,
    ) ?? null
  )
}
