import type { SupabaseClient } from '@supabase/supabase-js'
import {
  CATEGORIAS_PROFISSIONAIS_SLUG,
  categoriaProfissionalParaSlug,
  isCanalAdmProfissionalGlobal,
  isCanalFinanceiroProfissional,
  slugCanalComunidadeProfissional,
} from '@/lib/canaisProfissionalSlugs'
import { contarMensageiroFinanceiroNaoLidas } from '@/lib/financeiroMensageiroLeitura'
import { categoriasIncluemAnfitriao } from '@/lib/anfitriaoDualMode'
import { chaveProfissionalCanal } from '@/lib/canaisProfissionaisListaUi'
import {
  buscarMapaStatusDegustacaoCanalEmpresa,
  itemCanalFinanceiroContaComoNaoLidoEmpresa,
  type CanalFinanceiroRowEmpresa,
} from '@/lib/canaisEmpresaVisibilidade'
import { itemCanalFinanceiroEhAvisoManifesto } from '@/lib/recomendacaoContratacaoDestino'

export type CanalVisibilidadeRow = {
  id: string
  nome?: string | null
  tipo_publico?: string | null
  categoria?: string | null
  comunidade_prof?: string | null
  empresa_id?: string | null
  ativo?: boolean | null
}

/**
 * Slugs de `profissionais.categorias` do utilizador autenticado.
 */
export async function buscarSlugsCategoriasProfissional(
  supabase: SupabaseClient,
  usuarioId: string,
): Promise<string[]> {
  if (!usuarioId) return []
  const { data } = await supabase.from('profissionais').select('categorias').eq('usuario_id', usuarioId).maybeSingle()
  const cats = Array.isArray(data?.categorias) ? data.categorias.map(String) : []
  const slugs = [...new Set(cats.map((c) => categoriaProfissionalParaSlug(c)).filter(Boolean))]
  return slugs.filter((s) => (CATEGORIAS_PROFISSIONAIS_SLUG as readonly string[]).includes(s))
}

/**
 * Canal global profissional (ADM categoria / Financeiro) visível na lista do profissional.
 */
export function canalGlobalProfissionalVisivel(
  canal: CanalVisibilidadeRow,
  slugsProfissional: string[],
): boolean {
  if (canal.tipo_publico !== 'profissional' || canal.empresa_id != null) return false
  if (isCanalAdmProfissionalGlobal(canal)) return false
  if (isCanalFinanceiroProfissional(canal.nome)) return true
  const slug = slugCanalComunidadeProfissional(canal.categoria, canal.nome)
  return slug != null && slugsProfissional.includes(slug)
}

/**
 * Canal de empresa visível para o profissional (comunidade compatível).
 */
export function canalEmpresaVisivelParaProfissional(
  canal: CanalVisibilidadeRow,
  slugsProfissional: string[],
  empresasAprovadas: Set<string> | null,
): boolean {
  if (canal.tipo_publico !== 'empresa' || canal.empresa_id == null) return false
  if (empresasAprovadas && !empresasAprovadas.has(String(canal.empresa_id))) return false
  const comuSlug =
    categoriaProfissionalParaSlug(canal.comunidade_prof) ||
    chaveProfissionalCanal({
      nome: canal.nome,
      categoria: canal.categoria,
      comunidade_prof: canal.comunidade_prof,
    })
  if (!comuSlug || !(CATEGORIAS_PROFISSIONAIS_SLUG as readonly string[]).includes(comuSlug)) return false
  return slugsProfissional.includes(comuSlug)
}

/**
 * IDs de canais cujas mensagens entram no badge / lista do profissional.
 */
export async function obterIdsCanaisMensagensProfissional(
  supabase: SupabaseClient,
  usuarioId: string,
): Promise<Set<string>> {
  const slugs = await buscarSlugsCategoriasProfissional(supabase, usuarioId)
  if (slugs.length === 0) {
    const { data: fin } = await supabase
      .from('canais')
      .select('id, nome, tipo_publico, empresa_id')
      .eq('ativo', true)
      .eq('tipo_publico', 'profissional')
      .is('empresa_id', null)
    const ids = new Set<string>()
    for (const c of fin ?? []) {
      if (isCanalFinanceiroProfissional(c.nome)) ids.add(String(c.id))
    }
    return ids
  }

  let empresasAprovadas: Set<string> | null = null
  try {
    const { data: emps, error } = await supabase.from('empresas').select('id').eq('status', 'aprovado')
    if (!error) empresasAprovadas = new Set((emps ?? []).map((e) => String(e.id)))
  } catch {
    empresasAprovadas = null
  }

  const { data: canais, error: canaisErr } = await supabase
    .from('canais')
    .select('id, nome, tipo_publico, categoria, comunidade_prof, empresa_id')
    .eq('ativo', true)
    .in('tipo_publico', ['profissional', 'empresa'])

  if (canaisErr) {
    console.error('obterIdsCanaisMensagensProfissional:', canaisErr)
    return new Set()
  }

  const ids = new Set<string>()
  for (const c of canais ?? []) {
    const row: CanalVisibilidadeRow = {
      id: String(c.id),
      nome: c.nome,
      tipo_publico: c.tipo_publico,
      categoria: c.categoria,
      comunidade_prof: c.comunidade_prof,
      empresa_id: c.empresa_id,
    }
    if (canalGlobalProfissionalVisivel(row, slugs) || canalEmpresaVisivelParaProfissional(row, slugs, empresasAprovadas)) {
      ids.add(row.id)
    }
  }
  return ids
}

/** Notificações financeiras da empresa de hospedagem do anfitrião (canal profissional unificado). */
async function contarFinanceiroEmpresaHospedagemAnfitriao(
  supabase: SupabaseClient,
  usuarioId: string,
): Promise<number> {
  if (!usuarioId) return 0
  const { data: prof } = await supabase
    .from('profissionais')
    .select('categorias, empresa_hospedagem_id')
    .eq('usuario_id', usuarioId)
    .maybeSingle()
  const cats = Array.isArray(prof?.categorias)
    ? prof.categorias.filter((c): c is string => typeof c === 'string')
    : []
  const empresaId = prof?.empresa_hospedagem_id != null ? String(prof.empresa_hospedagem_id) : ''
  if (!empresaId || !categoriasIncluemAnfitriao(cats)) return 0

  const [{ data: rows, error }, statusDeg] = await Promise.all([
    supabase
      .from('canal_financeiro')
      .select('id, tipo, lida_por_empresa, metadata, comprovante_detalhes')
      .eq('empresa_id', empresaId),
    buscarMapaStatusDegustacaoCanalEmpresa(supabase, empresaId),
  ])
  if (error) {
    console.error('contarFinanceiroEmpresaHospedagemAnfitriao:', error)
    return 0
  }
  return (rows ?? []).filter((r) => {
    if (itemCanalFinanceiroEhAvisoManifesto(r)) return false
    return itemCanalFinanceiroContaComoNaoLidoEmpresa(r as CanalFinanceiroRowEmpresa, statusDeg)
  }).length
}

/**
 * Avisos não lidos no canal financeiro (tabela `canal_financeiro`).
 */
export async function contarFinanceiroNaoLidasProfissional(
  supabase: SupabaseClient,
  usuarioId: string,
): Promise<number> {
  if (!usuarioId) return 0
  const { data: prof } = await supabase
    .from('profissionais')
    .select('id, categorias')
    .eq('usuario_id', usuarioId)
    .maybeSingle()
  const profissionalId = prof?.id != null ? String(prof.id) : ''
  if (!profissionalId) return 0

  const cats = Array.isArray(prof?.categorias)
    ? prof.categorias.filter((c): c is string => typeof c === 'string')
    : []
  const ehAnfitriao = categoriasIncluemAnfitriao(cats)

  let profQuery = supabase
    .from('canal_financeiro')
    .select('id, tipo, titulo, mensagem')
    .eq('profissional_id', profissionalId)
    .eq('lida_por_profissional', false)

  if (ehAnfitriao) {
    profQuery = profQuery.not('tipo', 'in', '(manifesto,manifesto_indicacao)')
  }

  const [{ data: rowsProf, error }, mensageiro, { data: pendentesTpl, error: tplErr }, extraEmpresaHospedagem] =
    await Promise.all([
    profQuery,
    contarMensageiroFinanceiroNaoLidas(supabase, usuarioId),
    supabase
      .from('turista_pre_liberacoes')
      .select('id, canal_financeiro_id')
      .eq('profissional_usuario_id', usuarioId)
      .eq('status', 'pendente'),
    contarFinanceiroEmpresaHospedagemAnfitriao(supabase, usuarioId),
  ])

  if (error) {
    console.error('contarFinanceiroNaoLidasProfissional:', error)
    return mensageiro
  }

  const countProf = (rowsProf ?? []).filter((r) =>
    ehAnfitriao ? !itemCanalFinanceiroEhAvisoManifesto(r) : true,
  ).length

  const extraTpl =
    tplErr || !pendentesTpl
      ? 0
      : pendentesTpl.filter((r) => r.canal_financeiro_id == null).length

  return countProf + extraTpl + mensageiro + extraEmpresaHospedagem
}

/** Marca todos os avisos financeiros do profissional como lidos (ao abrir o canal). */
export async function marcarFinanceiroLidoProfissional(
  supabase: SupabaseClient,
  usuarioId: string,
): Promise<void> {
  if (!usuarioId) return
  const { data: prof } = await supabase
    .from('profissionais')
    .select('id, categorias')
    .eq('usuario_id', usuarioId)
    .maybeSingle()
  const profissionalId = prof?.id != null ? String(prof.id) : ''
  if (!profissionalId) return

  const { error } = await supabase
    .from('canal_financeiro')
    .update({ lida_por_profissional: true })
    .eq('profissional_id', profissionalId)
    .eq('lida_por_profissional', false)
    .neq('tipo', 'pre_liberacao_turista')

  if (error) console.error('marcarFinanceiroLidoProfissional:', error)

  const cats = Array.isArray(prof?.categorias)
    ? prof.categorias.filter((c): c is string => typeof c === 'string')
    : []
  if (!categoriasIncluemAnfitriao(cats)) return

  // Legado: avisos de manifesto (por tipo ou texto) não devem permanecer como não lidos para anfitrião.
  const { data: pendentes } = await supabase
    .from('canal_financeiro')
    .select('id, tipo, titulo, mensagem')
    .eq('profissional_id', profissionalId)
    .eq('lida_por_profissional', false)

  const idsManifesto = (pendentes ?? [])
    .filter((r) => itemCanalFinanceiroEhAvisoManifesto(r))
    .map((r) => String(r.id))
  if (idsManifesto.length === 0) return

  const { error: errManifesto } = await supabase
    .from('canal_financeiro')
    .update({ lida_por_profissional: true })
    .in('id', idsManifesto)
  if (errManifesto) console.error('marcarFinanceiroLidoProfissional manifesto:', errManifesto)
}
