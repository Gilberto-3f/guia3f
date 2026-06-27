import { pickAutorDisplay } from '@/lib/feed-autor'

/**
 * Linha da view `posts_com_autores` → objeto consumido pelo `PostCard`.
 * @param {unknown} raw
 */
export function mapPostComAutoresRow(raw) {
  const p = /** @type {Record<string, unknown>} */ (raw)
  let u = p.usuarios
  if (typeof p.usuarios === 'string') {
    try {
      u = JSON.parse(p.usuarios)
    } catch {
      u = null
    }
  }
  const autor = pickAutorDisplay(u, {
    autorTipo: p.autor_tipo != null ? String(p.autor_tipo) : null,
  })
  return {
    id: String(p.id),
    tipo: p.tipo != null ? String(p.tipo) : 'texto',
    texto: p.texto != null ? String(p.texto) : null,
    foto_url: p.foto_url != null ? String(p.foto_url) : null,
    conteudo_url: p.conteudo_url != null ? String(p.conteudo_url) : null,
    total_curtidas: Number(p.total_curtidas) || 0,
    total_comentarios: Number(p.total_comentarios) || 0,
    total_compartilhamentos: Number(p.total_compartilhamentos) || 0,
    total_reposts: Number(p.total_reposts) || 0,
    avaliacao_meta:
      p.avaliacao_meta && typeof p.avaliacao_meta === 'object' && !Array.isArray(p.avaliacao_meta)
        ? /** @type {Record<string, unknown>} */ (p.avaliacao_meta)
        : null,
    created_at: String(p.created_at ?? ''),
    post_original_id: p.post_original_id != null ? String(p.post_original_id) : null,
    autor,
  }
}
