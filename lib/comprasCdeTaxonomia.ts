import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizarTextoTaxonomia, type ProdutoCategoriaRow } from '@/lib/comprasCdeCatalogo'

export async function listarCategoriasProduto(
  supabase: SupabaseClient,
): Promise<ProdutoCategoriaRow[]> {
  const { data, error } = await supabase
    .from('produto_categorias')
    .select('id, slug, nome, ordem')
    .order('ordem', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: String(r.id),
    slug: String(r.slug),
    nome: String(r.nome),
    ordem: Number(r.ordem) || 0,
  }))
}

/**
 * Resolve ou cria subcategoria na categoria.
 * Agrupa por nome_normalizado (primeira ocorrência vira canônica).
 */
export async function resolverOuCriarSubcategoria(
  supabase: SupabaseClient,
  categoriaId: string,
  nomeInformado: string,
): Promise<{ id: string; nome: string }> {
  const nome = nomeInformado.trim()
  const norm = normalizarTextoTaxonomia(nome)
  if (!norm) throw new Error('Informe a subcategoria.')

  const { data: existente, error: errSelect } = await supabase
    .from('produto_subcategorias')
    .select('id, nome')
    .eq('categoria_id', categoriaId)
    .eq('nome_normalizado', norm)
    .maybeSingle()
  if (errSelect) throw errSelect
  if (existente?.id) {
    return { id: String(existente.id), nome: String(existente.nome) }
  }

  const { data: criada, error: errInsert } = await supabase
    .from('produto_subcategorias')
    .insert({
      categoria_id: categoriaId,
      nome,
      nome_normalizado: norm,
    })
    .select('id, nome')
    .single()

  if (errInsert) {
    // Corrida: outro insert com mesmo norm
    if (errInsert.code === '23505') {
      const { data: again } = await supabase
        .from('produto_subcategorias')
        .select('id, nome')
        .eq('categoria_id', categoriaId)
        .eq('nome_normalizado', norm)
        .maybeSingle()
      if (again?.id) return { id: String(again.id), nome: String(again.nome) }
    }
    throw errInsert
  }

  return { id: String(criada.id), nome: String(criada.nome) }
}

/**
 * Resolve ou cria marca global por nome_normalizado.
 */
export async function resolverOuCriarMarca(
  supabase: SupabaseClient,
  nomeInformado: string,
): Promise<{ id: string; nome: string }> {
  const nome = nomeInformado.trim()
  const norm = normalizarTextoTaxonomia(nome)
  if (!norm) throw new Error('Informe a marca do produto.')

  const { data: existente, error: errSelect } = await supabase
    .from('produto_marcas')
    .select('id, nome')
    .eq('nome_normalizado', norm)
    .maybeSingle()
  if (errSelect) throw errSelect
  if (existente?.id) {
    return { id: String(existente.id), nome: String(existente.nome) }
  }

  const { data: criada, error: errInsert } = await supabase
    .from('produto_marcas')
    .insert({ nome, nome_normalizado: norm })
    .select('id, nome')
    .single()

  if (errInsert) {
    if (errInsert.code === '23505') {
      const { data: again } = await supabase
        .from('produto_marcas')
        .select('id, nome')
        .eq('nome_normalizado', norm)
        .maybeSingle()
      if (again?.id) return { id: String(again.id), nome: String(again.nome) }
    }
    throw errInsert
  }

  return { id: String(criada.id), nome: String(criada.nome) }
}
