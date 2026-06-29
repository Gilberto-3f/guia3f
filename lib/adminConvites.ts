import type { AdminPermissoes } from '@/app/[locale]/(admin)/dashboard/admin/types/admin.types'

export type FuncaoAdminConvite = 2 | 3 | 4

export const FUNCOES_ADMIN_CONVITE: ReadonlyArray<{
  nivel: FuncaoAdminConvite
  label: string
  descricao: string
}> = [
  {
    nivel: 2,
    label: 'ADM moderador',
    descricao:
      'Liderança de uma categoria: verificação de cadastros, denúncias da comunidade e tabelas de serviços.',
  },
  {
    nivel: 3,
    label: 'ADM financeiro',
    descricao: 'Organiza a página Espaço ADM (planos, assinaturas, comissões e parceiros).',
  },
  {
    nivel: 4,
    label: 'Auxiliar ADM',
    descricao: 'Auxilia empresas que contratarem o serviço exclusivo de auxiliar administrativo.',
  },
]

export const COMUNIDADES_MODERADOR: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'guias', label: 'Guias de Turismo' },
  { value: 'taxistas', label: 'Taxistas' },
  { value: 'apps', label: 'Motoristas APP' },
  { value: 'vans', label: 'Vans' },
  { value: 'anfitrioes', label: 'Anfitriões / Hospedagem' },
]

export function rotuloFuncaoAdmin(nivel: number): string {
  const hit = FUNCOES_ADMIN_CONVITE.find((f) => f.nivel === nivel)
  if (hit) return hit.label
  if (nivel === 1) return 'ADM GERAL'
  return 'Administrador'
}

export function rotuloComunidadeModerador(comunidade: string | null | undefined): string {
  const v = String(comunidade ?? '').trim()
  if (!v) return ''
  return COMUNIDADES_MODERADOR.find((c) => c.value === v)?.label ?? v
}

export function cargoPorNivel(nivel: number): string {
  if (nivel === 2) return 'MODERADOR'
  if (nivel === 3) return 'FINANCEIRO'
  if (nivel === 4) return 'AUXILIAR_ADM'
  return 'ADM_GERAL'
}

export function permissoesPadraoPorNivel(
  nivel: number,
  comunidade?: string | null,
): AdminPermissoes & { cargo: string; comunidade: string | null; nivel: number; modulos: string[]; recursos: string[] } {
  if (nivel === 2) {
    const com = comunidade ?? null
    return {
      nivel: 2,
      cargo: 'MODERADOR',
      comunidade: com,
      modulos: ['verificacao', 'denuncias', 'servicos-tabelados'],
      recursos: com ? [com] : [],
      verificacao: { turistas: false, profissionais: true, empresas: com === 'anfitrioes' },
      denuncias: { turistas: true, profissionais: true, empresas: com === 'anfitrioes' },
      espacoAdm: { graficos: false, empresas: false, financeiro: false, gerencia: false },
      configuracoes: { apis: false, geral: false, seguranca: false },
    }
  }
  if (nivel === 3) {
    return {
      nivel: 3,
      cargo: 'FINANCEIRO',
      comunidade: null,
      modulos: ['espaco-adm'],
      recursos: ['financeiro', 'graficos', 'empresas'],
      verificacao: { turistas: false, profissionais: false, empresas: false },
      denuncias: { turistas: false, profissionais: false, empresas: false },
      espacoAdm: { graficos: true, empresas: true, financeiro: true, gerencia: false },
      configuracoes: { apis: true, geral: false, seguranca: false },
    }
  }
  return {
    nivel: 4,
    cargo: 'AUXILIAR_ADM',
    comunidade: null,
    modulos: ['espaco-adm'],
    recursos: ['empresas'],
    verificacao: { turistas: false, profissionais: false, empresas: false },
    denuncias: { turistas: false, profissionais: false, empresas: false },
    espacoAdm: { graficos: false, empresas: true, financeiro: false, gerencia: false },
    configuracoes: { apis: false, geral: false, seguranca: false },
  }
}
