'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { pickAutorDisplay } from '@/lib/feed-autor'
import PostCard from '@/components/PostCard'

/**
 * @param {{ usuarioId: string | null }} props
 */
export default function SalvosDrawer({ usuarioId }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async (uid) => {
    const { data: salvos, error } = await supabase
      .from('item_salvo')
      .select('post_id, salvo_em')
      .eq('usuario_id', uid)
      .order('salvo_em', { ascending: false })

    if (error) {
      console.error(error)
      setPosts([])
      return
    }

    const ids = [...new Set((salvos ?? []).map((r) => String(r.post_id)).filter(Boolean))]
    if (ids.length === 0) {
      setPosts([])
      return
    }

    const { data: viewRows, error: e2 } = await supabase.from('posts_com_autores').select('*').in('id', ids)
    if (e2) {
      console.error(e2)
      setPosts([])
      return
    }

    const byId = new Map()
    for (const row of viewRows ?? []) {
      const r = /** @type {Record<string, unknown>} */ (row)
      byId.set(String(r.id), r)
    }

    const ordenados = []
    for (const id of ids) {
      const raw = byId.get(id)
      if (!raw) continue
      if (raw.deleted_at != null && raw.deleted_at !== '') continue
      ordenados.push(mapViewRow(raw))
    }
    setPosts(ordenados)
  }, [])

  useEffect(() => {
    if (!usuarioId) {
      setPosts([])
      setLoading(false)
      return
    }
    setLoading(true)
    void carregar(usuarioId).finally(() => setLoading(false))
  }, [usuarioId, carregar])

  const removerPost = useCallback((postId) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId))
  }, [])

  if (!usuarioId) {
    return <p className="px-1 text-sm text-gray-500">Entre na conta para ver os salvos.</p>
  }

  return (
    <div className="space-y-4 px-1 pb-4">
      {loading ? <p className="py-6 text-center text-sm text-gray-400">Carregando…</p> : null}
      {!loading && posts.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">Nenhum post salvo ainda.</p>
      ) : null}
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          meuUsuarioId={usuarioId}
          onRemove={removerPost}
          onPostLocalPatch={(postId, patch) => {
            setPosts((prev) => prev.map((x) => (x.id === postId ? { ...x, ...patch } : x)))
          }}
          onItemSalvoChange={(postId, aindaSalvo) => {
            if (!aindaSalvo) setPosts((prev) => prev.filter((p) => p.id !== postId))
          }}
        />
      ))}
    </div>
  )
}

/** @param {unknown} raw */
function mapViewRow(raw) {
  const p = /** @type {Record<string, unknown>} */ (raw)
  let u = p.usuarios
  if (typeof p.usuarios === 'string') {
    try {
      u = JSON.parse(p.usuarios)
    } catch {
      u = null
    }
  }
  const autor = pickAutorDisplay(u)
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
        ? p.avaliacao_meta
        : null,
    created_at: String(p.created_at ?? ''),
    post_original_id: p.post_original_id != null ? String(p.post_original_id) : null,
    autor,
  }
}
