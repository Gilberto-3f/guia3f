'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { pickAutorDisplay } from '@/lib/feed-autor'
import PostCard from '@/components/PostCard'

const POSTS_FEED_VIEW = 'posts_com_autores'

type PostFeedRow = {
  id: string
  tipo: string
  texto: string | null
  foto_url: string | null
  conteudo_url: string | null
  total_curtidas: number
  total_comentarios: number
  total_compartilhamentos: number
  total_reposts: number
  avaliacao_meta: Record<string, unknown> | null
  created_at: string
  post_original_id: string | null
  autor: {
    nome: string
    username: string
    foto_perfil_url: string | null
    usuario_id: string
    empresa_id: string
    role: string
  }
}

function PerfilAtividadePostInner() {
  const params = useParams()
  const searchParams = useSearchParams()
  const postId = typeof params.id === 'string' ? params.id : params.id?.[0] ?? ''
  const comentarioDestaque = searchParams.get('comentario')

  const [post, setPost] = useState<PostFeedRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [meuId, setMeuId] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)

  const mapRow = useCallback((raw: unknown): PostFeedRow => {
    const p = raw as Record<string, unknown>
    const rawU = p.usuarios
    let u: unknown = rawU
    if (typeof rawU === 'string') {
      try {
        u = JSON.parse(rawU) as unknown
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
          ? (p.avaliacao_meta as Record<string, unknown>)
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
      const row = data as Record<string, unknown>
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
    return (
      <div className="min-h-screen bg-gray-50 p-4 pb-24">
        <p className="text-gray-600">Publicação inválida.</p>
        <Link href="/perfil" className="mt-4 inline-block text-[#0097b2]">
          Voltar ao perfil
        </Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-400">Carregando publicação…</p>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 pb-24">
        <p className="text-gray-600">Esta publicação não está mais disponível.</p>
        <Link href="/perfil" className="mt-4 inline-block text-[#0097b2]">
          Voltar ao perfil
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-200 bg-white px-3 py-3">
        <Link
          href="/perfil"
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-gray-800 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
          Perfil
        </Link>
      </header>
      <div className="p-4">
        <PostCard
          post={post}
          meuUsuarioId={meuId}
          userEmail={email}
          storyAtivo={null}
          onRemove={() => setPost(null)}
          abrirComentariosInicial={true}
          destacarComentarioId={comentarioDestaque}
        />
      </div>
    </div>
  )
}

export default function PerfilAtividadePostPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <p className="text-gray-400">Carregando…</p>
        </div>
      }
    >
      <PerfilAtividadePostInner />
    </Suspense>
  )
}
