import type { AdminPermissoes, AdminUser } from '../types/admin.types'
import type { AbaPrincipalId } from '../components/shared/AbasNavegacao'

export type ModuloPermissao =
  | 'verificacao.turistas'
  | 'verificacao.profissionais'
  | 'verificacao.empresas'
  | 'denuncias.turistas'
  | 'denuncias.profissionais'
  | 'denuncias.empresas'
  | 'espacoAdm.graficos'
  | 'espacoAdm.empresas'
  | 'espacoAdm.financeiro'
  | 'espacoAdm.gerencia'
  | 'configuracoes.apis'
  | 'configuracoes.geral'
  | 'configuracoes.seguranca'

function readFlag(perms: AdminPermissoes, key: ModuloPermissao): boolean | undefined {
  const [grupo, sub] = key.split('.') as [keyof AdminPermissoes, string]
  const g: any = perms?.[grupo]
  return typeof g?.[sub] === 'boolean' ? (g[sub] as boolean) : undefined
}

export function isAdmGeral(admin: AdminUser): boolean {
  return admin.admin_level === 1
}

export function podeAcessar(admin: AdminUser, key: ModuloPermissao): boolean {
  if (admin.admin_level === 1) return true
  const rawCargo = (admin.admin_permissoes as unknown as { cargo?: string })?.cargo
  if (key === 'configuracoes.apis' && rawCargo === 'FINANCEIRO') return true
  const flag = readFlag(admin.admin_permissoes ?? {}, key)
  return flag === true
}

const PASTA_MODULO: Record<AbaPrincipalId, string> = {
  'visao-geral': 'visao-geral',
  cadastros: 'verificacao',
  denuncias: 'denuncias',
  'servicos-tabelados': 'servicos-tabelados',
  'espaco-adm': 'espaco-adm',
  configuracoes: 'configuracoes',
}

/** Pastas visíveis no painel principal da Dashboard ADM. */
export function podeAcessarPasta(admin: AdminUser, pastaId: AbaPrincipalId): boolean {
  if (admin.admin_level === 1) return true
  if (pastaId === 'configuracoes') return false
  const raw = admin.admin_permissoes as unknown as { modulos?: string[]; cargo?: string }
  const modulos = Array.isArray(raw?.modulos) ? raw.modulos : []
  const mod = PASTA_MODULO[pastaId]
  return modulos.includes(mod)
}

export function withDefaultsAdminPerms(input: unknown): AdminPermissoes {
  if (!input || typeof input !== 'object') return {}
  return input as AdminPermissoes
}

