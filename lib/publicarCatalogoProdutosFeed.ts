import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProdutoCdeRow } from '@/lib/comprasCdeCatalogo'

export type SnapshotProdutoFeed = {
  id: string
  nome: string
  foto_url: string | null
  preco_usd: number
  percentual_desconto: number
  marca_nome: string | null
  subcategoria_nome: string | null
}

export function snapshotProdutosParaFeed(produtos: ProdutoCdeRow[]): SnapshotProdutoFeed[] {
  return produtos.map((p) => ({
    id: p.id,
    nome: p.nome,
    foto_url: p.fotos[0] ?? p.foto_url,
    preco_usd: p.preco_usd,
    percentual_desconto: Number(p.percentual_desconto) || 0,
    marca_nome: p.marca_nome ?? null,
    subcategoria_nome: p.subcategoria_nome ?? null,
  }))
}

/**
 * Ativa produtos pendentes no catálogo público e cria post no feed
 * (`tipo: catalogo_produtos` + snapshot em avaliacao_meta).
 */
export async function publicarCatalogoProdutosFeed(
  supabase: SupabaseClient,
  opts: {
    empresaId: string
    autorId: string
    username: string
    produtoIds: string[]
    snapshots: SnapshotProdutoFeed[]
  },
): Promise<{ ok: true; postId: string } | { ok: false; error: string }> {
  const ids = opts.produtoIds.filter(Boolean)
  if (!ids.length) return { ok: false, error: 'Nenhum produto para publicar.' }

  const agora = new Date().toISOString()
  const { error: errUp } = await supabase
    .from('produtos')
    .update({ ativo: true, updated_at: agora })
    .eq('empresa_id', opts.empresaId)
    .in('id', ids)
  if (errUp) return { ok: false, error: errUp.message }

  const qtd = ids.length
  const texto =
    qtd === 1
      ? 'cadastramos 1 novo produto em nosso catálogo, venha conferir.'
      : `cadastramos ${qtd} novos produtos em nosso catálogo, venha conferir.`

  const { data: post, error: errPost } = await supabase
    .from('posts')
    .insert({
      autor_id: opts.autorId,
      autor_tipo: 'empresa',
      empresa_id: opts.empresaId,
      texto,
      foto_url: null,
      conteudo_url: null,
      tipo: 'catalogo_produtos',
      avaliacao_meta: {
        kind: 'catalogo_produtos',
        empresa_id: opts.empresaId,
        quantidade: qtd,
        produto_ids: ids,
        produtos: opts.snapshots.slice(0, 3),
      },
    })
    .select('id')
    .single()

  if (errPost) return { ok: false, error: errPost.message }
  return { ok: true, postId: String(post.id) }
}
