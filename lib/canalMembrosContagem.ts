import type { SupabaseClient } from '@supabase/supabase-js'
import { categoriaCombinaChaveComercio, ORDEM_CATEGORIA_COMERCIO } from '@/lib/comissoesCategorias'
import { chaveSegmentoEmpresaDeCanal } from '@/lib/canaisEmpresasSegmentoUi'
import { slugCanalSegmentoEmpresa, isCanalFinanceiroEmpresa, isCanalAdmEmpresaGlobal } from '@/lib/canaisEmpresaSlugs'
import {
  categoriaProfissionalParaSlug,
  isCanalAdmProfissionalGlobal,
  isCanalFinanceiroProfissional,
  slugCanalComunidadeProfissional,
} from '@/lib/canaisProfissionalSlugs'

export type CanalMembrosRow = {
  id: string
  nome?: string | null
  tipo_publico?: string | null
  categoria?: string | null
  comunidade_prof?: string | null
  empresa_id?: string | null
  empresa_categoria?: string | null
}

type AudienciaCanal =
  | { tipo: 'nenhum' }
  | { tipo: 'todos_profissionais_ativos' }
  | { tipo: 'profissionais_categoria'; slug: string }
  | { tipo: 'todos_empresas_aprovadas' }
  | { tipo: 'empresas_segmento'; chave: string }

type BaseMembros = {
  totalProfissionais: number
  profissionaisPorSlug: Map<string, number>
  totalEmpresas: number
  empresasPorSegmento: Map<string, number>
}

function extrairSlugsCategoriasProf(categorias: unknown): string[] {
  const arr = Array.isArray(categorias) ? categorias : []
  const slugs = new Set<string>()
  for (const item of arr) {
    const slug = categoriaProfissionalParaSlug(String(item ?? ''))
    if (slug) slugs.add(slug)
  }
  return [...slugs]
}

/** Classifica quem recebe mensagens publicadas neste canal. */
export function classificarAudienciaCanal(canal: CanalMembrosRow): AudienciaCanal {
  if (String(canal.id ?? '').startsWith('__placeholder')) return { tipo: 'nenhum' }

  if (canal.tipo_publico === 'profissional' && canal.empresa_id == null) {
    if (isCanalAdmProfissionalGlobal(canal)) return { tipo: 'nenhum' }
    if (isCanalFinanceiroProfissional(canal.nome)) return { tipo: 'todos_profissionais_ativos' }
    const slug = slugCanalComunidadeProfissional(canal.categoria, canal.nome)
    if (slug) return { tipo: 'profissionais_categoria', slug }
  }

  if (canal.tipo_publico === 'empresa' && canal.empresa_id == null) {
    if (isCanalFinanceiroEmpresa(canal.nome)) return { tipo: 'todos_empresas_aprovadas' }
    if (isCanalAdmEmpresaGlobal(canal)) return { tipo: 'todos_empresas_aprovadas' }
    const chave = chaveSegmentoEmpresaDeCanal(canal)
    if (chave) return { tipo: 'empresas_segmento', chave }
    const segSlug = slugCanalSegmentoEmpresa(canal.categoria, canal.nome)
    if (segSlug) {
      const chaveFromSlug =
        segSlug === 'gastronomia'
          ? 'Restaurantes'
          : segSlug === 'passeios'
            ? 'Atrativos'
            : segSlug === 'lojas'
              ? 'Lojas'
              : segSlug === 'hospedagem'
                ? 'Hospedagem'
                : null
      if (chaveFromSlug) return { tipo: 'empresas_segmento', chave: chaveFromSlug }
    }
  }

  if (canal.tipo_publico === 'empresa' && canal.empresa_id != null && canal.comunidade_prof) {
    const slug = categoriaProfissionalParaSlug(canal.comunidade_prof)
    if (slug) return { tipo: 'profissionais_categoria', slug }
  }

  return { tipo: 'nenhum' }
}

export function canalExibeContagemMembros(canal: CanalMembrosRow): boolean {
  return classificarAudienciaCanal(canal).tipo !== 'nenhum'
}

export function formatarLegendaMembrosCanal(total: number): string {
  if (total === 0) return 'Nenhum membro'
  if (total === 1) return '1 membro'
  return `${total.toLocaleString('pt-BR')} membros`
}

function contarParaAudiencia(aud: AudienciaCanal, base: BaseMembros): number | null {
  switch (aud.tipo) {
    case 'todos_profissionais_ativos':
      return base.totalProfissionais
    case 'profissionais_categoria':
      return base.profissionaisPorSlug.get(aud.slug) ?? 0
    case 'todos_empresas_aprovadas':
      return base.totalEmpresas
    case 'empresas_segmento':
      return base.empresasPorSegmento.get(aud.chave) ?? 0
    default:
      return null
  }
}

export async function carregarBaseContagemMembrosCanais(supabase: SupabaseClient): Promise<BaseMembros> {
  const profissionaisPorSlug = new Map<string, number>()
  let totalProfissionais = 0

  const { data: profs, error: profErr } = await supabase
    .from('profissionais')
    .select('categorias, usuarios!profissionais_usuario_id_fkey(status, role)')
    .eq('usuarios.status', 'ativo')
    .eq('usuarios.role', 'profissional')

  if (profErr) {
    console.error('carregarBaseContagemMembrosCanais profissionais:', profErr)
  } else {
    for (const row of profs ?? []) {
      totalProfissionais += 1
      const slugs = extrairSlugsCategoriasProf(row.categorias)
      for (const slug of slugs) {
        profissionaisPorSlug.set(slug, (profissionaisPorSlug.get(slug) ?? 0) + 1)
      }
    }
  }

  const empresasPorSegmento = new Map<string, number>()
  let totalEmpresas = 0

  const { data: emps, error: empErr } = await supabase.from('empresas').select('categoria').eq('status', 'aprovado')

  if (empErr) {
    console.error('carregarBaseContagemMembrosCanais empresas:', empErr)
  } else {
    totalEmpresas = emps?.length ?? 0
    for (const row of emps ?? []) {
      const cat = row.categoria != null ? String(row.categoria) : ''
      for (const chave of ORDEM_CATEGORIA_COMERCIO) {
        if (categoriaCombinaChaveComercio(cat, chave)) {
          empresasPorSegmento.set(chave, (empresasPorSegmento.get(chave) ?? 0) + 1)
        }
      }
    }
  }

  return {
    totalProfissionais,
    profissionaisPorSlug,
    totalEmpresas,
    empresasPorSegmento,
  }
}

/** Mapa canalId → quantidade de membros que recebem o conteúdo do canal. */
export async function carregarContagensMembrosPorCanais(
  supabase: SupabaseClient,
  canais: CanalMembrosRow[],
): Promise<Record<string, number>> {
  const base = await carregarBaseContagemMembrosCanais(supabase)
  const out: Record<string, number> = {}
  for (const canal of canais) {
    const aud = classificarAudienciaCanal(canal)
    const n = contarParaAudiencia(aud, base)
    if (n != null) out[canal.id] = n
  }
  return out
}
