import type { SupabaseClient } from '@supabase/supabase-js'
import type { ServicoLocalRow } from '@/lib/servicosLocaisCatalogo'

export type SnapshotServicoFeed = {
  id: string
  nome: string
  foto_url: string | null
  preco_usd: number
  percentual_desconto: number
  categoria_nome: string | null
}

export function snapshotServicosParaFeed(servicos: ServicoLocalRow[]): SnapshotServicoFeed[] {
  return servicos.map((s) => ({
    id: s.id,
    nome: s.nome,
    foto_url: s.fotos[0] ?? s.foto_url,
    preco_usd: s.preco_usd,
    percentual_desconto: Number(s.percentual_desconto) || 0,
    categoria_nome: s.categoria_nome ?? null,
  }))
}

/**
 * Ativa serviços pendentes e cria post no feed (`tipo: catalogo_servicos`).
 */
export async function publicarServicosLocaisFeed(
  supabase: SupabaseClient,
  opts: {
    empresaId: string
    autorId: string
    username: string
    servicoIds: string[]
    snapshots: SnapshotServicoFeed[]
  },
): Promise<{ ok: true; postId: string } | { ok: false; error: string }> {
  const ids = opts.servicoIds.filter(Boolean)
  if (!ids.length) return { ok: false, error: 'Nenhum serviço para publicar.' }

  const agora = new Date().toISOString()
  const { error: errUp } = await supabase
    .from('servicos_locais_itens')
    .update({ ativo: true, updated_at: agora })
    .eq('empresa_id', opts.empresaId)
    .in('id', ids)
  if (errUp) return { ok: false, error: errUp.message }

  const qtd = ids.length
  const texto =
    qtd === 1
      ? 'cadastramos 1 novo serviço em nosso catálogo, venha conferir.'
      : `cadastramos ${qtd} novos serviços em nosso catálogo, venha conferir.`

  const { data: post, error: errPost } = await supabase
    .from('posts')
    .insert({
      autor_id: opts.autorId,
      autor_tipo: 'empresa',
      empresa_id: opts.empresaId,
      texto,
      foto_url: null,
      conteudo_url: null,
      tipo: 'catalogo_servicos',
      avaliacao_meta: {
        kind: 'catalogo_servicos',
        empresa_id: opts.empresaId,
        quantidade: qtd,
        servico_ids: ids,
        servicos: opts.snapshots.slice(0, 3),
      },
    })
    .select('id')
    .single()

  if (errPost) return { ok: false, error: errPost.message }
  return { ok: true, postId: String(post.id) }
}
