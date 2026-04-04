'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { pickAutorDisplay } from '@/lib/feed-autor'
import PostCard from '@/components/PostCard'

type PostSalvoRow = {
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

function mapViewRow(raw: unknown): PostSalvoRow {
  const p = raw as Record<string, unknown>
  let u: unknown = p.usuarios
  if (typeof p.usuarios === 'string') {
    try {
      u = JSON.parse(p.usuarios) as unknown
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
}

export default function PerfilSalvosPage() {
  const router = useRouter()
  const locale = useLocale()
  const [meuId, setMeuId] = useState<string | null>(null)
  const [posts, setPosts] = useState<PostSalvoRow[]>([])
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async (uid: string) => {
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

    const byId = new Map<string, Record<string, unknown>>()
    for (const row of viewRows ?? []) {
      const r = row as Record<string, unknown>
      byId.set(String(r.id), r)
    }

    const ordenados: PostSalvoRow[] = []
    for (const id of ids) {
      const raw = byId.get(id)
      if (!raw) continue
      if (raw.deleted_at != null && raw.deleted_at !== '') continue
      ordenados.push(mapViewRow(raw))
    }
    setPosts(ordenados)
  }, [])

  useEffect(() => {
    let ativo = true
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const id = session?.user?.id ?? null
      if (!ativo) return
      setMeuId(id)
      if (!id) {
        router.replace(`/${locale}/login`)
        setLoading(false)
        return
      }
      setLoading(true)
      await carregar(id)
      if (ativo) setLoading(false)
    })()
    return () => {
      ativo = false
    }
  }, [carregar, router, locale])

  const removerPost = useCallback((postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId))
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded p-2 text-gray-600 hover:bg-gray-100"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900">Salvos</h1>
      </header>
      <div className="space-y-4 p-4">
        {loading ? <p className="py-6 text-center text-sm text-gray-400">Carregando…</p> : null}
        {!loading && posts.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-500">Nenhum post salvo ainda.</p>
        ) : null}
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            meuUsuarioId={meuId}
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
    </div>
  )
}
