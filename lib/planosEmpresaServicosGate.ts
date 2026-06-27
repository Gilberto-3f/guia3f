import type { ServicoPlanoId } from '@/lib/planosEmpresaCatalogo'

export type MenuEmpresaId =
  | 'feed-stories'
  | 'cadastrar-comissao'
  | 'publicidade'
  | 'chat-adm'
  | 'denuncias'
  | 'compras-paraguai'
  | 'botao-dinamico'
  | 'auxiliar-adm'

export type AbaDashboardEmpresa = 'funil' | 'mercado' | 'drena'

export type FeatureEmpresaId =
  | 'pagina_rede_social'
  | 'botao_dinamico'
  | 'botao_chamar_corrida'
  | 'canais'
  | 'planejador_publicacoes'
  | 'publicidade'
  | 'auxiliar_adm'

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
  'botao-dinamico': 'botao_dinamico',
  'auxiliar-adm': 'auxiliar_adm',
}

const FEATURE_SERVICO: Record<FeatureEmpresaId, ServicoPlanoId> = {
  pagina_rede_social: 'pagina_rede_social',
  botao_dinamico: 'botao_dinamico',
  botao_chamar_corrida: 'botao_chamar_corrida',
  canais: 'canais',
  planejador_publicacoes: 'planejador_publicacoes',
  publicidade: 'publicidade',
  auxiliar_adm: 'auxiliar_adm',
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

/** Item do menu lateral: liberado para uso quando o serviço está no plano/degustação. */
export function menuEmpresaLiberado(menuId: MenuEmpresaId, servicos: readonly string[]): boolean {
  const servico = MENU_SERVICO[menuId]
  if (servico === null) return true
  return empresaTemServico(servicos, servico)
}

/**
 * Visibilidade no menu: Publicidade sempre aparece (página trata upgrade);
 * demais itens só quando o serviço correspondente está liberado.
 */
export function menuEmpresaVisivel(menuId: MenuEmpresaId, servicos: readonly string[]): boolean {
  if (menuId === 'publicidade') return true
  return menuEmpresaLiberado(menuId, servicos)
}

export function abaDashboardLiberada(aba: AbaDashboardEmpresa, servicos: readonly string[]): boolean {
  return empresaTemServico(servicos, ABA_SERVICO[aba])
}

export function featureEmpresaLiberada(feature: FeatureEmpresaId, servicos: readonly string[]): boolean {
  return empresaTemServico(servicos, FEATURE_SERVICO[feature])
}

/** Propaganda na Home (serviço publicidade no plano ou degustação). */
export function publicidadeHomeLiberada(servicos: readonly string[]): boolean {
  return empresaTemServico(servicos, 'publicidade')
}

/** Catálogo Publicidade Externa: só com plano contratado (não em degustação). */
export function publicidadeExternaLiberada(
  servicos: readonly string[],
  opts: { emDegustacao: boolean; assinaturaContratadaVigente: boolean },
): boolean {
  if (!empresaTemServico(servicos, 'publicidade')) return false
  if (opts.emDegustacao) return false
  return opts.assinaturaContratadaVigente
}

export function resolverServicosDoPlano(
  planoEmpresa: string | null | undefined,
  planos: PlanoResumoServicos[],
  opts?: { planoId?: string | null },
): ServicoPlanoId[] {
  const p = normalizarPlanoSlug(planoEmpresa ?? '')
  if (p && p !== 'gratuito') {
    const match = planos.find(
      (item) => normalizarPlanoSlug(item.nome) === p || normalizarPlanoSlug(item.titulo) === p,
    )
    if (match?.servicos?.length) return match.servicos
  }

  const planoId = opts?.planoId?.trim()
  if (planoId) {
    const porId = planos.find((item) => item.id === planoId)
    if (porId?.servicos?.length) return porId.servicos
  }

  return []
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

export type ResolverServicosEmpresaOpts = {
  planoContratadoId?: string | null
  /** Quando false, serviços do plano pago não entram (assinatura vencida). */
  assinaturaContratadaVigente?: boolean
}

export function resolverServicosEmpresa(
  planoEmpresa: string | null | undefined,
  planos: PlanoResumoServicos[],
  degustacao: boolean | DegustacaoServicosOpts,
  opts?: ResolverServicosEmpresaOpts,
): ServicoPlanoId[] {
  const optsDeg: DegustacaoServicosOpts =
    typeof degustacao === 'boolean' ? { ativa: degustacao } : degustacao

  if (optsDeg.ativa) {
    const doPlano = optsDeg.servicos?.length ? optsDeg.servicos : servicosPlanoBasico(planos)
    return [...doPlano]
  }

  if (opts?.assinaturaContratadaVigente === false) {
    return []
  }

  return resolverServicosDoPlano(planoEmpresa, planos, { planoId: opts?.planoContratadoId })
}

/** Serviços efetivos considerando degustação ativa (mapa empresa_id → plano_id da degustação). */
export function resolverServicosEmpresaComDegustacao(
  planoEmpresa: string | null | undefined,
  planos: PlanoResumoServicos[],
  degustacao?: { ativa: boolean; planoId?: string | null } | null,
  opts?: ResolverServicosEmpresaOpts,
): ServicoPlanoId[] {
  if (degustacao?.ativa) {
    const planoDeg = degustacao.planoId ? planos.find((p) => p.id === degustacao.planoId) : null
    return resolverServicosEmpresa(planoEmpresa, planos, {
      ativa: true,
      servicos: planoDeg?.servicos?.length ? planoDeg.servicos : null,
    })
  }
  return resolverServicosDoPlano(planoEmpresa, planos, { planoId: opts?.planoContratadoId })
}

/** Mesma regra do card do guia turístico (degustação ou plano contratado). */
export function empresaTemBotaoDinamicoPublico(
  planoEmpresa: string | null | undefined,
  planos: PlanoResumoServicos[],
  degustacao: { ativa: boolean; planoId?: string | null } | null | undefined,
  planoContratadoId: string | null | undefined,
): boolean {
  const servicos = resolverServicosEmpresaComDegustacao(
    planoEmpresa,
    planos,
    degustacao?.ativa ? { ativa: true, planoId: degustacao.planoId ?? null } : null,
    { planoContratadoId: planoContratadoId ?? null },
  )
  return empresaTemServico(servicos, 'botao_dinamico')
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
