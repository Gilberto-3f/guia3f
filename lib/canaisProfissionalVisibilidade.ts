import type { SupabaseClient } from '@supabase/supabase-js'
import {
  CATEGORIAS_PROFISSIONAIS_SLUG,
  categoriaProfissionalParaSlug,
  isCanalAdmProfissionalGlobal,
  isCanalFinanceiroProfissional,
  slugCanalComunidadeProfissional,
} from '@/lib/canaisProfissionalSlugs'

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
  const comuSlug = categoriaProfissionalParaSlug(canal.comunidade_prof)
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

/**
 * Avisos não lidos no canal financeiro (tabela `canal_financeiro`).
 */
export async function contarFinanceiroNaoLidasProfissional(
  supabase: SupabaseClient,
  usuarioId: string,
): Promise<number> {
  if (!usuarioId) return 0
  const { data: prof } = await supabase.from('profissionais').select('id').eq('usuario_id', usuarioId).maybeSingle()
  const profissionalId = prof?.id != null ? String(prof.id) : ''
  if (!profissionalId) return 0

  const { count, error } = await supabase
    .from('canal_financeiro')
    .select('id', { count: 'exact', head: true })
    .eq('profissional_id', profissionalId)
    .eq('lida_por_profissional', false)

  if (error) {
    console.error('contarFinanceiroNaoLidasProfissional:', error)
    return 0
  }
  return count ?? 0
}

/** Marca todos os avisos financeiros do profissional como lidos (ao abrir o canal). */
export async function marcarFinanceiroLidoProfissional(
  supabase: SupabaseClient,
  usuarioId: string,
): Promise<void> {
  if (!usuarioId) return
  const { data: prof } = await supabase.from('profissionais').select('id').eq('usuario_id', usuarioId).maybeSingle()
  const profissionalId = prof?.id != null ? String(prof.id) : ''
  if (!profissionalId) return

  const { error } = await supabase
    .from('canal_financeiro')
    .update({ lida_por_profissional: true })
    .eq('profissional_id', profissionalId)
    .eq('lida_por_profissional', false)

  if (error) console.error('marcarFinanceiroLidoProfissional:', error)
}
