'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { pickAutorDisplay } from '@/lib/feed-autor'
import { fetchPatrocinioAutorIds, isTipoVideoPost } from '@/lib/feedFiltroSeguidos'
import StoriesBar from '@/components/StoriesBar'
import PostCard from '@/components/PostCard'
import StoryViewer from '@/components/StoryViewer'

const PAGE_SIZE = 12

/** View no Supabase: posts + JSON `usuarios` (perfil do autor). Realtime continua na tabela `posts`. */
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

type StoryViewerState = {
  id: string
  tipo: string
  conteudo_url: string
  texto_sobreposto: { texto?: string | null; posicao_x?: number; posicao_y?: number } | null
  link: string | null
  duracao_segundos: number | null
  autorUsuarioId: string | null
}

function FeedPageInner() {
  const searchParams = useSearchParams()
  const postParam = searchParams.get('post')
  const comentarioParam = searchParams.get('comentario')

  const [posts, setPosts] = useState<PostFeedRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const pageRef = useRef(0)
  const sentinelRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const fetchPostAttempted = useRef<string | null>(null)

  const [meuId, setMeuId] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [feedRede, setFeedRede] = useState<{
    seguidos: string[]
    patrocinioAutores: string[]
    ready: boolean
  }>({ seguidos: [], patrocinioAutores: [], ready: false })
  const feedRedeRef = useRef({
    seguidos: [] as string[],
    patrocinioAutores: [] as string[],
    ready: false,
    meuId: null as string | null,
  })
  useEffect(() => {
    feedRedeRef.current = {
      seguidos: feedRede.seguidos,
      patrocinioAutores: feedRede.patrocinioAutores,
      ready: feedRede.ready,
      meuId,
    }
  }, [feedRede, meuId])
  const [storyAberto, setStoryAberto] = useState<StoryViewerState | null>(null)
  const [storiesBarReload, setStoriesBarReload] = useState(0)
  const [storiesPorAutor, setStoriesPorAutor] = useState<
    Record<string, { id: string; visualizado_por: unknown }>
  >({})

  const bumpStoriesBar = useCallback(() => {
    setStoriesBarReload((n) => n + 1)
  }, [])

  const carregarStoriesAutores = useCallback(async (lista: PostFeedRow[]) => {
    try {
      const ids = [...new Set(lista.map((p) => p.autor?.usuario_id).filter(Boolean))]
      if (ids.length === 0) {
        setStoriesPorAutor({})
        return
      }
      const { data, error } = await supabase
        .from('stories')
        .select('id, autor_id, visualizado_por, created_at, tipo')
        .in('autor_id', ids)
        .gt('expira_em', new Date().toISOString())
        .order('created_at', { ascending: false })
      if (error) {
        console.error(error)
        return
      }
      const map: Record<string, { id: string; visualizado_por: unknown }> = {}
      for (const row of data ?? []) {
        if (isTipoVideoPost((row as { tipo?: string }).tipo)) continue
        const aid = String(row.autor_id)
        if (!map[aid]) {
          map[aid] = { id: String(row.id), visualizado_por: row.visualizado_por }
        }
      }
      setStoriesPorAutor(map)
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    const boot = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setMeuId(session?.user?.id ?? null)
      setEmail(session?.user?.email ?? null)
    }
    void boot()
  }, [])

  const mapRow = useCallback((post: unknown) => {
    const p = post as Record<string, unknown>
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

  const fetchPage = useCallback(async (pageIndex: number) => {
    const from = pageIndex * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    const { seguidos, patrocinioAutores, ready, meuId: uidFromRef } = feedRedeRef.current as {
      seguidos: string[]
      patrocinioAutores: string[]
      ready: boolean
      meuId?: string | null
    }
    if (!ready) return []

    const meu = uidFromRef ?? meuId
    const allowed = [...new Set([...seguidos, ...patrocinioAutores])].filter((id) => id && id !== meu)
    if (allowed.length === 0) return []

    const { data, error } = await supabase
      .from(POSTS_FEED_VIEW)
      .select('*')
      .in('autor_id', allowed)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw error
    const raw = data ?? []
    return raw
      .filter((row) => !(row as { deleted_at?: string | null }).deleted_at)
      .map(mapRow)
      .filter((row) => !isTipoVideoPost(row.tipo))
  }, [mapRow])

  useEffect(() => {
    if (!feedRede.ready) return
    const run = async () => {
      setLoading(true)
      pageRef.current = 0
      setHasMore(true)
      try {
        const first = await fetchPage(0)
        setPosts(first)
        setHasMore(first.length === PAGE_SIZE)
        pageRef.current = 1
      } catch (e) {
        console.error(e)
        setPosts([])
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [fetchPage, feedRede.ready])

  useEffect(() => {
    fetchPostAttempted.current = null
  }, [postParam])

  useEffect(() => {
    if (!postParam || loading || !feedRede.ready) return
    if (posts.some((p) => p.id === postParam)) return
    if (fetchPostAttempted.current === postParam) return
    fetchPostAttempted.current = postParam
    void (async () => {
      const { data, error } = await supabase.from(POSTS_FEED_VIEW).select('*').eq('id', postParam).maybeSingle()
      if (error || !data) {
        fetchPostAttempted.current = null
        return
      }
      if ((data as { deleted_at?: string | null }).deleted_at) {
        fetchPostAttempted.current = null
        return
      }
      const row = mapRow(data)
      if (isTipoVideoPost(row.tipo)) {
        fetchPostAttempted.current = null
        return
      }
      const { seguidos, patrocinioAutores, meuId: uidRef } = feedRedeRef.current
      const allowed = new Set([...seguidos, ...patrocinioAutores])
      const aid = row.autor?.usuario_id ?? ''
      if (uidRef && aid && aid !== uidRef && !allowed.has(aid)) {
        fetchPostAttempted.current = null
        return
      }
      setPosts((prev) => {
        if (prev.some((p) => p.id === row.id)) return prev
        return [row, ...prev]
      })
    })()
  }, [postParam, loading, posts, mapRow, feedRede.ready])

  useEffect(() => {
    if (!postParam || posts.length === 0) return
    const t = window.setTimeout(() => {
      document.getElementById(`feed-post-${postParam}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 400)
    return () => clearTimeout(t)
  }, [postParam, posts])

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const next = pageRef.current
      const chunk = await fetchPage(next)
      setPosts((prev) => [...prev, ...chunk])
      setHasMore(chunk.length === PAGE_SIZE)
      pageRef.current = next + 1
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingMore(false)
    }
  }, [fetchPage, hasMore, loadingMore])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore()
      },
      { rootMargin: '120px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [loadMore, posts.length])

  useEffect(() => {
    void carregarStoriesAutores(posts)
  }, [posts, storiesBarReload, carregarStoriesAutores])

  const abrirStory = async (id: string) => {
    const { data, error } = await supabase
      .from('stories')
      .select('id, conteudo_url, texto_sobreposto, link, tipo, duracao_segundos, autor_id')
      .eq('id', id)
      .maybeSingle()
    if (!error && data && String(data.tipo ?? '').toLowerCase() !== 'video') {
      const ts = data.texto_sobreposto
      const textoParsed =
        ts && typeof ts === 'object' && !Array.isArray(ts)
          ? (ts as { texto?: string | null; posicao_x?: number; posicao_y?: number })
          : null
      setStoryAberto({
        id: String(data.id),
        tipo: data.tipo != null ? String(data.tipo) : 'foto',
        conteudo_url: String(data.conteudo_url ?? ''),
        texto_sobreposto: textoParsed,
        link: data.link != null ? String(data.link) : null,
        duracao_segundos: data.duracao_segundos != null ? Number(data.duracao_segundos) : null,
        autorUsuarioId: data.autor_id != null ? String(data.autor_id) : null,
      })
    }
  }

  const removerPost = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId))
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-400">Carregando feed...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-gray-100">
        <StoriesBar userEmail={email} reloadSignal={storiesBarReload} onOpenStory={(id) => void abrirStory(id)} />
      </div>

      <div className="space-y-4 p-4">
        {posts.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-gray-400">Nenhuma publicação ainda</p>
            <p className="mt-1 text-sm text-gray-400">
              Siga perfis no Guia ou aguarde conteúdo de empresas em campanha para ver o feed aqui.
            </p>
          </div>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              meuUsuarioId={meuId}
              userEmail={email}
              storyAtivo={storiesPorAutor[post.autor?.usuario_id ?? ''] ?? null}
              onAbrirStory={(id) => void abrirStory(id)}
              onRemove={removerPost}
              abrirComentariosInicial={postParam === post.id && Boolean(comentarioParam)}
              destacarComentarioId={postParam === post.id ? comentarioParam : null}
              onRepublicouPrepend={(raw) => {
                const row = mapRow(raw)
                setPosts((prev) => (prev.some((x) => x.id === row.id) ? prev : [row, ...prev]))
              }}
              onPostLocalPatch={(postId, patch) => {
                setPosts((prev) => prev.map((x) => (x.id === postId ? { ...x, ...patch } : x)))
              }}
              onRepostRemovido={(repostPostId) => {
                setPosts((prev) => prev.filter((p) => p.id !== repostPostId))
              }}
            />
          ))
        )}
        <div ref={sentinelRef} className="h-4 w-full" aria-hidden />
        {loadingMore ? <p className="py-2 text-center text-sm text-gray-400">Carregando…</p> : null}
        {!hasMore && posts.length > 0 ? <p className="py-2 text-center text-xs text-gray-300">Fim do feed</p> : null}
      </div>

      {storyAberto ? (
        <StoryViewer
          story={storyAberto}
          userEmail={email}
          onVisualizado={bumpStoriesBar}
          onFechar={() => {
            setStoryAberto(null)
            bumpStoriesBar()
          }}
        />
      ) : null}
    </div>
  )
}

export default function FeedPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="animate-pulse text-gray-400">Carregando feed...</div>
        </div>
      }
    >
      <FeedPageInner />
    </Suspense>
  )
}
