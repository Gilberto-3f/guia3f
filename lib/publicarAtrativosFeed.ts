import type { SupabaseClient } from '@supabase/supabase-js'
import type { AtrativoExperienciaRow } from '@/lib/atrativosCatalogo'

export type SnapshotAtrativoFeed = {
  id: string
  nome: string
  foto_url: string | null
  categoria_nome: string | null
  preco_inteira: number | null
  preco_meia: number | null
}

export function snapshotAtrativosParaFeed(itens: AtrativoExperienciaRow[]): SnapshotAtrativoFeed[] {
  return itens.map((a) => ({
    id: a.id,
    nome: a.titulo,
    foto_url: a.fotos[0] ?? null,
    categoria_nome: a.categoria_nome ?? null,
    preco_inteira: a.preco_inteira,
    preco_meia: a.preco_meia,
  }))
}

/**
 * Ativa atrativos pendentes e cria post no feed (`tipo: catalogo_atrativos`).
 */
export async function publicarAtrativosFeed(
  supabase: SupabaseClient,
  opts: {
    empresaId: string
    autorId: string
    username: string
    atrativoIds: string[]
    snapshots: SnapshotAtrativoFeed[]
  },
): Promise<{ ok: true; postId: string } | { ok: false; error: string }> {
  const ids = opts.atrativoIds.filter(Boolean)
  if (!ids.length) return { ok: false, error: 'Nenhum atrativo para publicar.' }

  const agora = new Date().toISOString()
  const { error: errUp } = await supabase
    .from('atrativos_experiencias')
    .update({ ativo: true, updated_at: agora })
    .eq('empresa_id', opts.empresaId)
    .in('id', ids)
  if (errUp) return { ok: false, error: errUp.message }

  const qtd = ids.length
  const texto =
    qtd === 1
      ? 'cadastramos 1 novo atrativo em nosso catálogo, venha conferir.'
      : `cadastramos ${qtd} novos atrativos em nosso catálogo, venha conferir.`

  const { data: post, error: errPost } = await supabase
    .from('posts')
    .insert({
      autor_id: opts.autorId,
      autor_tipo: 'empresa',
      empresa_id: opts.empresaId,
      texto,
      foto_url: null,
      conteudo_url: null,
      tipo: 'catalogo_atrativos',
      avaliacao_meta: {
        kind: 'catalogo_atrativos',
        empresa_id: opts.empresaId,
        quantidade: qtd,
        atrativo_ids: ids,
        atrativos: opts.snapshots.slice(0, 3),
      },
    })
    .select('id')
    .single()

  if (errPost) return { ok: false, error: errPost.message }
  return { ok: true, postId: String(post.id) }
}
