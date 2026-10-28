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
import { primeiraCidadeAtuacao, resolverEcoCanaisPorCidade } from '@/lib/ecoCanaisPorCidade'
import { listarEcossistemasDb } from '@/lib/ecossistemas'

export type CanalMembrosRow = {
  id: string
  nome?: string | null
  tipo_publico?: string | null
  categoria?: string | null
  comunidade_prof?: string | null
  empresa_id?: string | null
  empresa_categoria?: string | null
  ecossistema_id?: string | null
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
                : segSlug === 'servicos_locais'
                  ? 'Serviços Locais'
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

function baseVazia(): BaseMembros {
  return {
    totalProfissionais: 0,
    profissionaisPorSlug: new Map(),
    totalEmpresas: 0,
    empresasPorSegmento: new Map(),
  }
}

function baseDoEco(porEco: Map<string, BaseMembros>, ecoId: string): BaseMembros {
  let base = porEco.get(ecoId)
  if (!base) {
    base = baseVazia()
    porEco.set(ecoId, base)
  }
  return base
}

async function carregarBasesPorEco(supabase: SupabaseClient): Promise<{
  porEco: Map<string, BaseMembros>
  ecoPorEmpresaId: Map<string, string>
}> {
  const porEco = new Map<string, BaseMembros>()
  const ecoPorEmpresaId = new Map<string, string>()
  let blocos
  try {
    blocos = await listarEcossistemasDb(supabase)
  } catch (e) {
    console.error('carregarBasesPorEco blocos:', e)
    return { porEco, ecoPorEmpresaId }
  }

  const { data: profs, error: profErr } = await supabase
    .from('profissionais')
    .select('categorias, cidade_atuacao, usuarios!profissionais_usuario_id_fkey(status, role)')
    .eq('usuarios.status', 'ativo')
    .eq('usuarios.role', 'profissional')

  if (profErr) {
    console.error('carregarBasesPorEco profissionais:', profErr)
  } else {
    for (const row of profs ?? []) {
      const bloco = resolverEcoCanaisPorCidade(primeiraCidadeAtuacao(row.cidade_atuacao), blocos)
      if (!bloco?.id) continue
      const base = baseDoEco(porEco, bloco.id)
      base.totalProfissionais += 1
      for (const slug of extrairSlugsCategoriasProf(row.categorias)) {
        base.profissionaisPorSlug.set(slug, (base.profissionaisPorSlug.get(slug) ?? 0) + 1)
      }
    }
  }

  const { data: emps, error: empErr } = await supabase
    .from('empresas')
    .select('id, categoria, cidade')
    .eq('status', 'aprovado')

  if (empErr) {
    console.error('carregarBasesPorEco empresas:', empErr)
  } else {
    for (const row of emps ?? []) {
      const bloco = resolverEcoCanaisPorCidade(row.cidade != null ? String(row.cidade) : '', blocos)
      if (!bloco?.id) continue
      ecoPorEmpresaId.set(String(row.id), bloco.id)
      const base = baseDoEco(porEco, bloco.id)
      base.totalEmpresas += 1
      const cat = row.categoria != null ? String(row.categoria) : ''
      for (const chave of ORDEM_CATEGORIA_COMERCIO) {
        if (categoriaCombinaChaveComercio(cat, chave)) {
          base.empresasPorSegmento.set(chave, (base.empresasPorSegmento.get(chave) ?? 0) + 1)
        }
      }
    }
  }

  return { porEco, ecoPorEmpresaId }
}

function ecoDoCanal(canal: CanalMembrosRow, ecoPorEmpresaId: Map<string, string>): string {
  const eco = canal.ecossistema_id != null ? String(canal.ecossistema_id).trim() : ''
  if (eco) return eco
  const empresaId = canal.empresa_id != null ? String(canal.empresa_id).trim() : ''
  if (empresaId) return ecoPorEmpresaId.get(empresaId) ?? ''
  return ''
}

/** Mapa canalId → quantidade de membros que recebem o conteúdo do canal (só o mesmo eco). */
export async function carregarContagensMembrosPorCanais(
  supabase: SupabaseClient,
  canais: CanalMembrosRow[],
): Promise<Record<string, number>> {
  const { porEco, ecoPorEmpresaId } = await carregarBasesPorEco(supabase)
  const out: Record<string, number> = {}
  for (const canal of canais) {
    const aud = classificarAudienciaCanal(canal)
    if (aud.tipo === 'nenhum') continue
    const ecoId = ecoDoCanal(canal, ecoPorEmpresaId)
    if (!ecoId) {
      out[canal.id] = 0
      continue
    }
    const n = contarParaAudiencia(aud, porEco.get(ecoId) ?? baseVazia())
    if (n != null) out[canal.id] = n
  }
  return out
}
