'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import PostCard from '@/components/PostCard'
import { pickAutorDisplay } from '@/lib/feed-autor'
import { isTipoVideoPost } from '@/lib/feedFiltroSeguidos'

const POSTS_FEED_VIEW = 'posts_com_autores'
const PAGE_LIMIT = 40

/**
 * @param {unknown} post
 */
function mapPostRow(post) {
  const p = /** @type {Record<string, unknown>} */ (post)
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
}

/**
 * @param {{ empresaUsuarioId: string | null }} props
 */
export default function AbaPostsEmpresa({ empresaUsuarioId }) {
  const [posts, setPosts] = useState(
    /** @type {ReturnType<typeof mapPostRow>[]} */ ([])
  )
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [meuUsuarioId, setMeuUsuarioId] = useState(/** @type {string | null} */ (null))
  const [email, setEmail] = useState(/** @type {string | null} */ (null))

  useEffect(() => {
    const run = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setMeuUsuarioId(session?.user?.id ?? null)
      setEmail(session?.user?.email ?? null)
    }
    void run()
  }, [])

  const carregar = useCallback(async () => {
    if (!empresaUsuarioId) {
      setPosts([])
      setLoading(false)
      setErro('')
      return
    }
    setLoading(true)
    setErro('')
    try {
      const { data, error } = await supabase
        .from(POSTS_FEED_VIEW)
        .select('*')
        .eq('autor_id', empresaUsuarioId)
        .order('created_at', { ascending: false })
        .limit(PAGE_LIMIT)

      if (error) {
        setErro(error.message)
        setPosts([])
        return
      }
      const rows = (data ?? [])
        .filter((row) => !(row && typeof row === 'object' && 'deleted_at' in row && (/** @type {{ deleted_at?: string }} */ (row)).deleted_at))
        .map(mapPostRow)
        .filter((row) => !isTipoVideoPost(row.tipo))
      setPosts(rows)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar posts')
      setPosts([])
    } finally {
      setLoading(false)
    }
  }, [empresaUsuarioId])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const handleEngagementChange = useCallback((postId, patch) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...patch } : p)))
  }, [])

  if (!empresaUsuarioId) {
    return <p className="py-10 text-center text-sm text-gray-500">Publicações indisponíveis para esta empresa.</p>
  }

  if (loading) {
    return (
      <div className="py-10 text-center text-sm text-gray-400">
        <div className="animate-pulse">Carregando publicações…</div>
      </div>
    )
  }

  if (erro) {
    return <p className="rounded-lg bg-amber-50 p-3 text-center text-sm text-amber-900">Não foi possível carregar os posts. {erro}</p>
  }

  if (posts.length === 0) {
    return <p className="py-10 text-center text-sm text-gray-500">Nenhuma publicação ainda</p>
  }

  return (
    <div className="space-y-4">
      {posts.map((p) => (
        <div key={p.id} id={`empresa-post-${p.id}`} className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <PostCard
            post={p}
            meuUsuarioId={meuUsuarioId}
            userEmail={email}
            onEngagementChange={handleEngagementChange}
            comentariosInline
          />
        </div>
      ))}
    </div>
  )
}
