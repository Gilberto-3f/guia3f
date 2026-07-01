import type { AdminPermissoes } from '@/app/[locale]/(admin)/dashboard/admin/types/admin.types'

export type FuncaoAdminConvite = 2 | 3 | 4

export type PaisModerador = 'BR' | 'AR' | 'PY'

export const PAISES_MODERADOR: ReadonlyArray<{ value: PaisModerador; label: string }> = [
  { value: 'BR', label: 'Brasil' },
  { value: 'AR', label: 'Argentina' },
  { value: 'PY', label: 'Paraguai' },
]

export const FUNCOES_ADMIN_CONVITE: ReadonlyArray<{
  nivel: FuncaoAdminConvite
  label: string
  descricao: string
}> = [
  {
    nivel: 2,
    label: 'Moderador',
    descricao:
      'Liderança de uma categoria e país: cadastros, denúncias da comunidade e Ecossistema.',
  },
  {
    nivel: 3,
    label: 'ADM Financeiro',
    descricao: 'Organiza o Espaço ADM (planos, assinaturas, comissões e parceiros).',
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
  { value: 'vans', label: 'Motoristas de Van' },
  { value: 'anfitrioes', label: 'Anfitriões' },
]

const COMUNIDADES_COM_SERVICOS_TABELADOS = new Set(['vans', 'guias', 'taxistas'])

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

export function rotuloPaisModerador(pais: string | null | undefined): string {
  const v = String(pais ?? '').trim().toUpperCase()
  if (!v) return ''
  return PAISES_MODERADOR.find((p) => p.value === v)?.label ?? v
}

export function cargoPorNivel(nivel: number): string {
  if (nivel === 2) return 'MODERADOR'
  if (nivel === 3) return 'FINANCEIRO'
  if (nivel === 4) return 'AUXILIAR_ADM'
  return 'ADM_GERAL'
}

export function modulosModerador(comunidade: string | null | undefined): string[] {
  const com = String(comunidade ?? '').trim()
  const modulos = ['verificacao', 'denuncias', 'visao-geral']
  if (COMUNIDADES_COM_SERVICOS_TABELADOS.has(com)) {
    modulos.push('servicos-tabelados')
  }
  return modulos
}

export type PermissoesAdminGranulares = AdminPermissoes & {
  cargo: string
  comunidade: string | null
  pais: string | null
  nivel: number
  modulos: string[]
  recursos: string[]
  participacao_percentual?: number | null
}

export function permissoesPadraoPorNivel(
  nivel: number,
  opts?: { comunidade?: string | null; pais?: string | null },
): PermissoesAdminGranulares {
  const comunidade = opts?.comunidade ?? null
  const pais = opts?.pais != null ? String(opts.pais).trim().toUpperCase() : null

  if (nivel === 2) {
    const com = comunidade
    return {
      nivel: 2,
      cargo: 'MODERADOR',
      comunidade: com,
      pais,
      modulos: modulosModerador(com),
      recursos: com ? [com] : [],
      participacao_percentual: null,
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
      pais: null,
      modulos: ['visao-geral', 'verificacao', 'denuncias', 'servicos-tabelados', 'espaco-adm'],
      recursos: ['financeiro', 'graficos', 'empresas'],
      participacao_percentual: null,
      verificacao: { turistas: true, profissionais: true, empresas: true },
      denuncias: { turistas: true, profissionais: true, empresas: true },
      espacoAdm: { graficos: true, empresas: true, financeiro: true, gerencia: false },
      configuracoes: { apis: true, geral: false, seguranca: false },
    }
  }
  return {
    nivel: 4,
    cargo: 'AUXILIAR_ADM',
    comunidade: null,
    pais: null,
    modulos: [],
    recursos: [],
    participacao_percentual: null,
    verificacao: { turistas: false, profissionais: false, empresas: false },
    denuncias: { turistas: false, profissionais: false, empresas: false },
    espacoAdm: { graficos: false, empresas: false, financeiro: false, gerencia: false },
    configuracoes: { apis: false, geral: false, seguranca: false },
  }
}

/** Mapeia valor de `profissionais.pais` para código BR/AR/PY. */
export function normalizarPaisProfissional(pais: string | null | undefined): string | null {
  const raw = String(pais ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
  if (!raw) return null
  if (raw === 'br' || raw.includes('brasil')) return 'BR'
  if (raw === 'ar' || raw.includes('argentin')) return 'AR'
  if (raw === 'py' || raw.includes('paraguai') || raw.includes('paraguay')) return 'PY'
  return raw.toUpperCase().slice(0, 2)
}
