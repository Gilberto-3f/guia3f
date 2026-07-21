import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizarTextoTaxonomia, type CardapioCategoriaRow } from '@/lib/cardapioCatalogo'

/**
 * Resolve ou cria sessão/categoria do cardápio na empresa.
 * Agrupa por nome_normalizado (ex.: "MASSAS").
 */
export async function resolverOuCriarCategoriaCardapio(
  supabase: SupabaseClient,
  empresaId: string,
  nomeInformado: string,
): Promise<{ id: string; nome: string }> {
  const nome = nomeInformado.trim()
  const norm = normalizarTextoTaxonomia(nome)
  if (!norm) throw new Error('Informe a categoria (sessão) do cardápio.')

  const { data: existente, error: errSelect } = await supabase
    .from('cardapio_categorias')
    .select('id, nome')
    .eq('empresa_id', empresaId)
    .eq('nome_normalizado', norm)
    .maybeSingle()
  if (errSelect) throw errSelect
  if (existente?.id) {
    return { id: String(existente.id), nome: String(existente.nome) }
  }

  const { data: criada, error: errInsert } = await supabase
    .from('cardapio_categorias')
    .insert({
      empresa_id: empresaId,
      nome,
      nome_normalizado: norm,
    })
    .select('id, nome')
    .single()

  if (errInsert) {
    if (errInsert.code === '23505') {
      const { data: again } = await supabase
        .from('cardapio_categorias')
        .select('id, nome')
        .eq('empresa_id', empresaId)
        .eq('nome_normalizado', norm)
        .maybeSingle()
      if (again?.id) return { id: String(again.id), nome: String(again.nome) }
    }
    throw errInsert
  }

  return { id: String(criada.id), nome: String(criada.nome) }
}

export async function listarCategoriasCardapioEmpresa(
  supabase: SupabaseClient,
  empresaId: string,
): Promise<CardapioCategoriaRow[]> {
  const { data, error } = await supabase
    .from('cardapio_categorias')
    .select('id, empresa_id, nome, nome_normalizado')
    .eq('empresa_id', empresaId)
    .order('nome', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: String(r.id),
    empresa_id: String(r.empresa_id),
    nome: String(r.nome),
    nome_normalizado: String(r.nome_normalizado),
  }))
}
