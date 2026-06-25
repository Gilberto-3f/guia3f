import type { AdminPermissoes, AdminUser } from '../types/admin.types'

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

export function withDefaultsAdminPerms(input: unknown): AdminPermissoes {
  if (!input || typeof input !== 'object') return {}
  return input as AdminPermissoes
}

