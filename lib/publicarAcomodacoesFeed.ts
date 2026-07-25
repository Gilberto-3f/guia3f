import type { SupabaseClient } from '@supabase/supabase-js'
import {
  rotuloAcomodacaoResumo,
  type HospedagemAcomodacaoRow,
} from '@/lib/hospedagemAcomodacoesCatalogo'

export type SnapshotAcomodacaoFeed = {
  id: string
  nome: string
  foto_url: string | null
  valor_diaria: number
  capacidade_pessoas: number
}

export function snapshotAcomodacoesParaFeed(
  itens: HospedagemAcomodacaoRow[],
): SnapshotAcomodacaoFeed[] {
  return itens.map((a) => ({
    id: a.id,
    nome: rotuloAcomodacaoResumo(a),
    foto_url: a.fotos[0] ?? null,
    valor_diaria: a.valor_diaria,
    capacidade_pessoas: a.capacidade_pessoas,
  }))
}

/**
 * Ativa acomodações pendentes e cria post no feed (`tipo: catalogo_acomodacoes`).
 */
export async function publicarAcomodacoesFeed(
  supabase: SupabaseClient,
  opts: {
    empresaId: string
    autorId: string
    username: string
    acomodacaoIds: string[]
    snapshots: SnapshotAcomodacaoFeed[]
  },
): Promise<{ ok: true; postId: string } | { ok: false; error: string }> {
  const ids = opts.acomodacaoIds.filter(Boolean)
  if (!ids.length) return { ok: false, error: 'Nenhuma acomodação para publicar.' }

  const agora = new Date().toISOString()
  const { error: errUp } = await supabase
    .from('hospedagem_acomodacoes')
    .update({ ativo: true, updated_at: agora })
    .eq('empresa_id', opts.empresaId)
    .in('id', ids)
  if (errUp) return { ok: false, error: errUp.message }

  const qtd = ids.length
  const texto =
    qtd === 1
      ? 'cadastramos 1 nova acomodação em nosso catálogo, venha conferir.'
      : `cadastramos ${qtd} novas acomodações em nosso catálogo, venha conferir.`

  const { data: post, error: errPost } = await supabase
    .from('posts')
    .insert({
      autor_id: opts.autorId,
      autor_tipo: 'empresa',
      empresa_id: opts.empresaId,
      texto,
      foto_url: null,
      conteudo_url: null,
      tipo: 'catalogo_acomodacoes',
      avaliacao_meta: {
        kind: 'catalogo_acomodacoes',
        empresa_id: opts.empresaId,
        quantidade: qtd,
        acomodacao_ids: ids,
        acomodacoes: opts.snapshots.slice(0, 3),
      },
    })
    .select('id')
    .single()

  if (errPost) return { ok: false, error: errPost.message }
  return { ok: true, postId: String(post.id) }
}
