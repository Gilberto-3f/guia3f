import type { ServicoPlanoId } from '@/lib/planosEmpresaCatalogo'

export type MenuEmpresaId =
  | 'feed-stories'
  | 'publicidade'
  | 'chat-adm'
  | 'denuncias'
  | 'compras-paraguai'

export type AbaDashboardEmpresa = 'funil' | 'mercado' | 'drena'

export type PlanoResumoServicos = {
  nome: string
  titulo: string
  servicos: ServicoPlanoId[]
}

const MENU_SERVICO: Record<MenuEmpresaId, ServicoPlanoId | null> = {
  'feed-stories': 'pagina_rede_social',
  publicidade: 'publicidade',
  'chat-adm': 'auxiliar_adm',
  denuncias: null,
  'compras-paraguai': 'compras_paraguai_drena',
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

export function menuEmpresaLiberado(menuId: MenuEmpresaId, servicos: readonly string[]): boolean {
  const servico = MENU_SERVICO[menuId]
  if (servico === null) return true
  return empresaTemServico(servicos, servico)
}

export function abaDashboardLiberada(aba: AbaDashboardEmpresa, servicos: readonly string[]): boolean {
  return empresaTemServico(servicos, ABA_SERVICO[aba])
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
