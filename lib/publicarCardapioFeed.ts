import type { SupabaseClient } from '@supabase/supabase-js'
import type { PratoCardapioRow } from '@/lib/cardapioCatalogo'

export type SnapshotPratoFeed = {
  id: string
  nome: string
  foto_url: string | null
  preco_usd: number
  percentual_desconto: number
  categoria_nome: string | null
}

export function snapshotPratosParaFeed(pratos: PratoCardapioRow[]): SnapshotPratoFeed[] {
  return pratos.map((p) => ({
    id: p.id,
    nome: p.nome,
    foto_url: p.fotos[0] ?? p.foto_url,
    preco_usd: p.preco_usd,
    percentual_desconto: Number(p.percentual_desconto) || 0,
    categoria_nome: p.categoria_nome ?? null,
  }))
}

/**
 * Ativa pratos pendentes e cria post no feed (`tipo: catalogo_cardapio`).
 */
export async function publicarCardapioFeed(
  supabase: SupabaseClient,
  opts: {
    empresaId: string
    autorId: string
    username: string
    pratoIds: string[]
    snapshots: SnapshotPratoFeed[]
  },
): Promise<{ ok: true; postId: string } | { ok: false; error: string }> {
  const ids = opts.pratoIds.filter(Boolean)
  if (!ids.length) return { ok: false, error: 'Nenhum prato para publicar.' }

  const agora = new Date().toISOString()
  const { error: errUp } = await supabase
    .from('cardapio_pratos')
    .update({ ativo: true, updated_at: agora })
    .eq('empresa_id', opts.empresaId)
    .in('id', ids)
  if (errUp) return { ok: false, error: errUp.message }

  const qtd = ids.length
  const texto =
    qtd === 1
      ? 'cadastramos 1 novo prato em nosso cardápio, venha conferir.'
      : `cadastramos ${qtd} novos pratos em nosso cardápio, venha conferir.`

  const { data: post, error: errPost } = await supabase
    .from('posts')
    .insert({
      autor_id: opts.autorId,
      autor_tipo: 'empresa',
      empresa_id: opts.empresaId,
      texto,
      foto_url: null,
      conteudo_url: null,
      tipo: 'catalogo_cardapio',
      avaliacao_meta: {
        kind: 'catalogo_cardapio',
        empresa_id: opts.empresaId,
        quantidade: qtd,
        prato_ids: ids,
        pratos: opts.snapshots.slice(0, 3),
      },
    })
    .select('id')
    .single()

  if (errPost) return { ok: false, error: errPost.message }
  return { ok: true, postId: String(post.id) }
}
