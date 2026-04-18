'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { pickAutorDisplay } from '@/lib/feed-autor'
import PostCard from '@/components/PostCard'

const POSTS_FEED_VIEW = 'posts_com_autores'

/**
 * @typedef {{
 *   id: string
 *   tipo: string
 *   texto: string | null
 *   foto_url: string | null
 *   conteudo_url: string | null
 *   total_curtidas: number
 *   total_comentarios: number
 *   total_compartilhamentos: number
 *   total_reposts: number
 *   avaliacao_meta: Record<string, unknown> | null
 *   created_at: string
 *   post_original_id: string | null
 *   autor: { nome: string, username: string, foto_perfil_url: string | null, usuario_id: string, empresa_id: string, role: string }
 * }} PostFeedShape
 */

/**
 * Publicação isolada dentro do drawer (mesmo dado que `/perfil/atividades/[id]`).
 *
 * @param {{
 *   postId: string
 *   comentarioId?: string | null
 * }} props
 */
export default function PostIsoladoDrawer({ postId, comentarioId = null }) {
  const [post, setPost] = useState(/** @type {PostFeedShape | null} */ (null))
  const [loading, setLoading] = useState(true)
  const [meuId, setMeuId] = useState(/** @type {string | null} */ (null))
  const [email, setEmail] = useState(/** @type {string | null} */ (null))

  const mapRow = useCallback((raw) => {
    const p = /** @type {Record<string, unknown>} */ (raw)
    const rawU = p.usuarios
    let u = rawU
    if (typeof rawU === 'string') {
      try {
        u = JSON.parse(rawU)
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
          ? /** @type {Record<string, unknown>} */ (p.avaliacao_meta)
          : null,
      created_at: String(p.created_at ?? ''),
      post_original_id: p.post_original_id != null ? String(p.post_original_id) : null,
      autor,
    }
  }, [])

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setMeuId(session?.user?.id ?? null)
      setEmail(session?.user?.email ?? null)
    })
  }, [])

  useEffect(() => {
    if (!postId) {
      setLoading(false)
      setPost(null)
      return
    }
    let ativo = true
    void (async () => {
      setLoading(true)
      const { data, error } = await supabase.from(POSTS_FEED_VIEW).select('*').eq('id', postId).maybeSingle()
      if (!ativo) return
      if (error || !data) {
        setPost(null)
        setLoading(false)
        return
      }
      const row = /** @type {Record<string, unknown>} */ (data)
      if (row.deleted_at != null) {
        setPost(null)
        setLoading(false)
        return
      }
      setPost(mapRow(data))
      setLoading(false)
    })()
    return () => {
      ativo = false
    }
  }, [postId, mapRow])

  if (!postId) {
    return <p className="text-sm text-gray-500">Publicação inválida.</p>
  }

  if (loading) {
    return <p className="py-8 text-center text-sm text-gray-400">Carregando publicação…</p>
  }

  if (!post) {
    return <p className="text-sm text-gray-500">Esta publicação não está mais disponível.</p>
  }

  const destacar = comentarioId != null && comentarioId !== '' ? String(comentarioId) : null

  return (
    <div className="pb-2">
      <PostCard
        post={post}
        meuUsuarioId={meuId}
        userEmail={email}
        storyAtivo={null}
        onRemove={() => setPost(null)}
        comentariosInline
        abrirComentariosInicial={false}
        destacarComentarioId={destacar}
      />
    </div>
  )
}
