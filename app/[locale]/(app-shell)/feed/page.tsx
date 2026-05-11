'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { pickAutorDisplay, sanearAutoresPostsEmpresaPreview } from '@/lib/feed-autor'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { isTipoVideoPost } from '@/lib/feedFiltroSeguidos'
import { fetchEmpresaFeedPromoAutorIds, intercalarPostsEmpresa } from '@/lib/intercalarFeedEmpresa'
import { fetchUsuarioIdsEmpresasFavoritas } from '@/lib/feedSeguidosEmpresasFavoritas'
import {
  escolherIdStoryInicialPorEmail,
  ordenarStoriesPorCreatedAsc,
  visualizadoPorConsolidadoParaAnel,
} from '@/lib/story-open-order'
import StoriesBar from '@/components/StoriesBar'
import PostCard from '@/components/PostCard'
import { POST_DELETED_EVENT } from '@/components/MenuPost'
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
  texto_sobreposto: {
    texto?: string | null
    posicao_x?: number
    posicao_y?: number
    link_posicao_x?: number
    link_posicao_y?: number
    fundo_fit?: 'contain' | 'cover'
    fundo_scale?: number
    fundo_pan_x_pct?: number
    fundo_pan_y_pct?: number
    texto_scale?: number
  } | null
  link: string | null
  duracao_segundos: number | null
  autorUsuarioId: string | null
  curtidas?: unknown
  visualizado_por?: unknown
}

type StoryOpenMeta = {
  filaAutores: string[]
  filaAutorIndex: number
}

type StoryModalPack = {
  ids: string[]
  index: number
  data: StoryViewerState
  playbackKey: number
  filaAutores: string[]
  filaAutorIndex: number
}

type StoryRowSelect = {
  id: unknown
  conteudo_url?: unknown
  texto_sobreposto?: unknown
  link?: unknown
  tipo?: unknown
  duracao_segundos?: unknown
  autor_id?: unknown
  curtidas?: unknown
  visualizado_por?: unknown
}

function mapStoryRowToViewerState(data: StoryRowSelect | null): StoryViewerState | null {
  if (!data) return null
  const url = String(data.conteudo_url ?? '').trim()
  if (!url) return null
  const ts = data.texto_sobreposto
  const textoParsed =
    ts && typeof ts === 'object' && !Array.isArray(ts) ? (ts as StoryViewerState['texto_sobreposto']) : null
  return {
    id: String(data.id),
    tipo: data.tipo != null ? String(data.tipo) : 'foto',
    conteudo_url: url,
    texto_sobreposto: textoParsed,
    link: data.link != null ? String(data.link) : null,
    duracao_segundos: data.duracao_segundos != null ? Number(data.duracao_segundos) : null,
    autorUsuarioId: data.autor_id != null ? String(data.autor_id) : null,
    curtidas: data.curtidas ?? null,
    visualizado_por: data.visualizado_por ?? null,
  }
}

function FeedPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const postParam = searchParams.get('post')
  const comentarioParam = searchParams.get('comentario')

  const [posts, setPosts] = useState<PostFeedRow[]>([])
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const pageRef = useRef(0)
  const mergeGenRef = useRef(0)
  const sentinelRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const fetchPostAttempted = useRef<string | null>(null)
  const [bloqueioEmpresaFeed, setBloqueioEmpresaFeed] = useState(false)

  const [meuId, setMeuId] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const { modoAtivo } = useModoApresentacao()
  /** Evita marcar o feed como “pronto” antes da sessão existir (corrida: ready com listas vazias e sem re-fetch). */
  const [authReady, setAuthReady] = useState(false)
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
  const [storyModal, setStoryModal] = useState<StoryModalPack | null>(null)
  const storyModalRef = useRef<StoryModalPack | null>(null)
  const [storiesBarReload, setStoriesBarReload] = useState(0)
  const [storiesPorAutor, setStoriesPorAutor] = useState<
    Record<string, { id: string; visualizado_por: unknown; conteudo_url?: string | null }>
  >({})

  useEffect(() => {
    setMounted(true)
  }, [])

  const bumpStoriesBar = useCallback(() => {
    setStoriesBarReload((n) => n + 1)
  }, [])

  const carregarStoriesAutores = useCallback(async (lista: PostFeedRow[], viewerEmail: string | null) => {
    try {
      const ids = [...new Set(lista.map((p) => p.autor?.usuario_id).filter(Boolean))]
      if (ids.length === 0) {
        setStoriesPorAutor({})
        return
      }
      const { data, error } = await supabase
        .from('stories')
        .select('id, autor_id, visualizado_por, created_at, tipo, conteudo_url')
        .in('autor_id', ids)
        .gt('expira_em', new Date().toISOString())
        .order('created_at', { ascending: true })
      if (error) {
        console.error(error)
        return
      }
      type StoryAggRow = {
        id: unknown
        autor_id?: unknown
        visualizado_por?: unknown
        created_at?: unknown
        tipo?: unknown
        conteudo_url?: unknown
      }
      const porAutor = new Map<string, StoryAggRow[]>()
      for (const row of data ?? []) {
        if (isTipoVideoPost((row as { tipo?: string }).tipo)) continue
        const aid = String((row as { autor_id: unknown }).autor_id)
        if (!porAutor.has(aid)) porAutor.set(aid, [])
        porAutor.get(aid)!.push(row as StoryAggRow)
      }
      const map: Record<string, { id: string; visualizado_por: unknown; conteudo_url?: string | null }> = {}
      for (const [aid, arrRaw] of porAutor) {
        const asc = ordenarStoriesPorCreatedAsc(arrRaw)
        const abrirId = escolherIdStoryInicialPorEmail(asc, viewerEmail)
        if (!abrirId) continue
        const latest = asc[asc.length - 1]
        const r = latest as { conteudo_url?: unknown }
        map[aid] = {
          id: abrirId,
          visualizado_por: visualizadoPorConsolidadoParaAnel(asc, viewerEmail),
          conteudo_url: r.conteudo_url != null ? String(r.conteudo_url) : null,
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
      setAuthReady(true)
    }
    void boot()
  }, [])

  useEffect(() => {
    let ativo = true
    const verificar = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user?.id || !ativo) return
      const { data: u } = await supabase.from('usuarios').select('role').eq('id', session.user.id).maybeSingle()
      if (!ativo) return
      if (String(u?.role ?? '') === 'empresa') {
        setBloqueioEmpresaFeed(true)
        router.replace('/dashboard/empresa')
      }
    }
    void verificar()
    return () => {
      ativo = false
    }
  }, [router])

  const recarregarFeedRede = useCallback(async () => {
    if (!meuId) {
      setFeedRede({ seguidos: [], patrocinioAutores: [], ready: true })
      return
    }
    try {
      const [{ data: segRows }, autoresEmpresasFavoritas] = await Promise.all([
        supabase.from('redecontatos').select('seguido_id').eq('seguidor_id', meuId),
        fetchUsuarioIdsEmpresasFavoritas(supabase, meuId),
      ])
      const seguidosRede = (segRows ?? []).map((r) => String((r as { seguido_id: string }).seguido_id)).filter(Boolean)
      const seguidos = [...new Set([...seguidosRede, ...autoresEmpresasFavoritas])].filter(Boolean)
      setFeedRede({
        seguidos,
        patrocinioAutores: [],
        ready: true,
      })
    } catch (e) {
      console.error(e)
      setFeedRede({ seguidos: [], patrocinioAutores: [], ready: true })
    }
  }, [meuId])

  useEffect(() => {
    if (!authReady) return
    void recarregarFeedRede()
  }, [authReady, meuId, recarregarFeedRede])

  useEffect(() => {
    const onReload = () => void recarregarFeedRede()
    window.addEventListener('guia-feed-rede-reload', onReload)
    return () => window.removeEventListener('guia-feed-rede-reload', onReload)
  }, [recarregarFeedRede])

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

  const rebuildMergedPosts = useCallback(
    async (generation: number): Promise<PostFeedRow[]> => {
      const { seguidos, ready, meuId: uidRef } = feedRedeRef.current as {
        seguidos: string[]
        ready: boolean
        meuId?: string | null
      }
      if (!ready) return []

      const meu = uidRef ?? meuId
      const organicAllowed = [...new Set([...(meu ? [meu] : []), ...seguidos])].filter(Boolean)

      const promoIds = await fetchEmpresaFeedPromoAutorIds(supabase, {
        seguidosSet: new Set(seguidos),
        meuId: meu ?? undefined,
      })

      const organicLimit = 40 + generation * 45
      const promoLimit = 60

      const [{ data: dOrg }, { data: dPromo }] = await Promise.all([
        organicAllowed.length > 0
          ? supabase
              .from(POSTS_FEED_VIEW)
              .select('*')
              .in('autor_id', organicAllowed)
              .order('created_at', { ascending: false })
              .limit(organicLimit)
          : Promise.resolve({ data: [] as unknown[] }),
        promoIds.length > 0
          ? supabase
              .from(POSTS_FEED_VIEW)
              .select('*')
              .in('autor_id', promoIds)
              .order('created_at', { ascending: false })
              .limit(promoLimit)
          : Promise.resolve({ data: [] as unknown[] }),
      ])

      const orgRows = (dOrg ?? []).filter((row) => !(row as { deleted_at?: string | null }).deleted_at)
      const proRows = (dPromo ?? []).filter((row) => !(row as { deleted_at?: string | null }).deleted_at)

      const orgMapped = orgRows.map(mapRow).filter((row) => !isTipoVideoPost(row.tipo))
      const proMapped = proRows.map(mapRow).filter((row) => !isTipoVideoPost(row.tipo))

      const merged = intercalarPostsEmpresa(orgMapped, proMapped, (r) => r.autor?.usuario_id ?? '', 20)
      const saneados = await sanearAutoresPostsEmpresaPreview(
        supabase,
        merged,
        email,
        modoAtivo
      )
      return saneados as PostFeedRow[]
    },
    [mapRow, meuId, email, modoAtivo]
  )

  useEffect(() => {
    if (!feedRede.ready || bloqueioEmpresaFeed) return
    const run = async () => {
      setLoading(true)
      mergeGenRef.current = 0
      pageRef.current = 0
      setHasMore(true)
      try {
        const merged = await rebuildMergedPosts(0)
        setPosts(merged.slice(0, PAGE_SIZE))
        setHasMore(merged.length > PAGE_SIZE)
        pageRef.current = 1
      } catch (e) {
        console.error(e)
        setPosts([])
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [rebuildMergedPosts, feedRede.ready, meuId, feedRede.seguidos, bloqueioEmpresaFeed])

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
      const mapped = mapRow(data)
      const [row] = (await sanearAutoresPostsEmpresaPreview(supabase, [mapped], email, modoAtivo)) as PostFeedRow[]
      if (isTipoVideoPost(row.tipo)) {
        fetchPostAttempted.current = null
        return
      }
      const { seguidos, meuId: uidRef } = feedRedeRef.current
      const promoIds = await fetchEmpresaFeedPromoAutorIds(supabase, {
        seguidosSet: new Set(seguidos),
        meuId: uidRef ?? undefined,
      })
      const allowed = new Set([...seguidos, ...promoIds, ...(uidRef ? [uidRef] : [])])
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
  }, [postParam, loading, posts, mapRow, feedRede.ready, meuId, email, modoAtivo])

  useEffect(() => {
    if (!postParam || posts.length === 0) return
    const t = window.setTimeout(() => {
      document.getElementById(`feed-post-${postParam}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 400)
    return () => clearTimeout(t)
  }, [postParam, posts])

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || bloqueioEmpresaFeed) return
    setLoadingMore(true)
    try {
      mergeGenRef.current += 1
      const merged = await rebuildMergedPosts(mergeGenRef.current)
      const nextTotal = posts.length + PAGE_SIZE
      setPosts(merged.slice(0, nextTotal))
      setHasMore(merged.length > nextTotal)
      pageRef.current += 1
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingMore(false)
    }
  }, [rebuildMergedPosts, hasMore, loadingMore, posts.length, bloqueioEmpresaFeed])

  /** Recarrega a primeira página (ex.: após editar perfil — evento `perfil-atualizado`). */
  const recarregarPrimeiraPagina = useCallback(async () => {
    if (!feedRede.ready || bloqueioEmpresaFeed) return
    setLoading(true)
    mergeGenRef.current = 0
    pageRef.current = 0
    setHasMore(true)
    fetchPostAttempted.current = null
    try {
      const merged = await rebuildMergedPosts(0)
      setPosts(merged.slice(0, PAGE_SIZE))
      setHasMore(merged.length > PAGE_SIZE)
      pageRef.current = 1
    } catch (e) {
      console.error(e)
      setPosts([])
    } finally {
      setLoading(false)
    }
    bumpStoriesBar()
  }, [bumpStoriesBar, feedRede.ready, rebuildMergedPosts, bloqueioEmpresaFeed])

  useEffect(() => {
    const onPerfilAtualizado = () => {
      void recarregarPrimeiraPagina()
    }
    window.addEventListener('perfil-atualizado', onPerfilAtualizado)
    return () => window.removeEventListener('perfil-atualizado', onPerfilAtualizado)
  }, [recarregarPrimeiraPagina])

  useEffect(() => {
    const onPostDeleted = (e: Event) => {
      const ce = e as CustomEvent<{ postId: string; postParentId: string | null }>
      const { postId, postParentId } = ce.detail ?? {}
      if (!postId) return
      setPosts((prev) =>
        prev.filter((p) => {
          if (p.id === postId) return false
          if (postParentId == null && p.post_original_id === postId) return false
          return true
        })
      )
    }
    window.addEventListener(POST_DELETED_EVENT, onPostDeleted)
    return () => window.removeEventListener(POST_DELETED_EVENT, onPostDeleted)
  }, [])

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
    void carregarStoriesAutores(posts, email)
  }, [posts, storiesBarReload, carregarStoriesAutores, email])

  useEffect(() => {
    storyModalRef.current = storyModal
  }, [storyModal])

  const carregarStoryPorId = useCallback(async (storyId: string): Promise<StoryViewerState | null> => {
    const { data, error } = await supabase
      .from('stories')
      .select('id, conteudo_url, texto_sobreposto, link, tipo, duracao_segundos, autor_id, curtidas, visualizado_por')
      .eq('id', storyId)
      .maybeSingle()
    if (error) {
      console.error('carregarStoryPorId:', error)
      return null
    }
    const mapped = mapStoryRowToViewerState(data as StoryRowSelect)
    if (!mapped) console.warn('carregarStoryPorId: story inválido', storyId)
    return mapped
  }, [])

  /** Fila de stories de um autor (antigo → novo); sempre abre no mais antigo (índice 0). */
  const montarPackStoryAutor = useCallback(
    async (autorUsuarioId: string): Promise<{ ids: string[]; index: number; data: StoryViewerState } | null> => {
      const { data: rows, error } = await supabase
        .from('stories')
        .select('id, tipo, created_at, visualizado_por')
        .eq('autor_id', autorUsuarioId)
        .gt('expira_em', new Date().toISOString())
        .order('created_at', { ascending: true })
      if (error || !rows?.length) return null
      const asc = rows.filter((r) => !isTipoVideoPost((r as { tipo?: string }).tipo))
      if (asc.length === 0) return null
      const ids = asc.map((r) => String((r as { id: unknown }).id))
      const index = 0
      const data = await carregarStoryPorId(ids[index])
      if (!data) return null
      return { ids, index, data }
    },
    [carregarStoryPorId]
  )

  const abrirStory = useCallback(
    async (id: string, meta?: StoryOpenMeta) => {
      const probe = await carregarStoryPorId(id)
      if (!probe) return
      const autorId = probe.autorUsuarioId
      if (!autorId) {
        setStoryModal({
          ids: [probe.id],
          index: 0,
          data: probe,
          playbackKey: 0,
          filaAutores: [],
          filaAutorIndex: 0,
        })
        return
      }
      const pack = await montarPackStoryAutor(autorId)
      if (!pack) return
      const { ids, index, data } = pack
      const filaAutores = meta?.filaAutores?.length ? meta.filaAutores : [autorId]
      const filaAutorIndex =
        meta?.filaAutores?.length && typeof meta.filaAutorIndex === 'number' && meta.filaAutorIndex >= 0
          ? meta.filaAutorIndex
          : Math.max(0, filaAutores.indexOf(autorId))
      setStoryModal({
        ids,
        index,
        data,
        playbackKey: 0,
        filaAutores,
        filaAutorIndex,
      })
    },
    [carregarStoryPorId, montarPackStoryAutor]
  )

  const fecharStoryModal = useCallback(() => {
    setStoryModal(null)
    bumpStoriesBar()
  }, [bumpStoriesBar])

  const navegarStory = useCallback(
    async (delta: number) => {
      const cur = storyModalRef.current
      if (!cur) return
      const fila =
        cur.filaAutores?.length > 0
          ? cur.filaAutores
          : cur.data.autorUsuarioId
            ? [cur.data.autorUsuarioId]
            : []
      const fIdx = typeof cur.filaAutorIndex === 'number' && cur.filaAutorIndex >= 0 ? cur.filaAutorIndex : 0

      const n = cur.ids.length
      const rawNext = cur.index + delta
      if (rawNext < 0) {
        if (fIdx > 0 && cur.index === 0) {
          const prevAid = fila[fIdx - 1]
          const pack = await montarPackStoryAutor(prevAid)
          if (!pack?.ids.length) {
            setStoryModal((p) => (p ? { ...p, index: 0, playbackKey: p.playbackKey + 1 } : null))
            return
          }
          const li = pack.ids.length - 1
          const mapped = await carregarStoryPorId(pack.ids[li])
          if (!mapped) {
            setStoryModal((p) => (p ? { ...p, index: 0, playbackKey: p.playbackKey + 1 } : null))
            return
          }
          if (!storyModalRef.current) return
          setStoryModal({
            ids: pack.ids,
            index: li,
            data: mapped,
            playbackKey: 0,
            filaAutores: fila,
            filaAutorIndex: fIdx - 1,
          })
          return
        }
        setStoryModal((p) => (p ? { ...p, index: 0, playbackKey: p.playbackKey + 1 } : null))
        return
      }
      if (rawNext >= n) {
        if (fila.length > 0 && fIdx < fila.length - 1) {
          const nextAid = fila[fIdx + 1]
          const pack = await montarPackStoryAutor(nextAid)
          if (!pack) {
            fecharStoryModal()
            return
          }
          if (!storyModalRef.current) return
          setStoryModal({
            ids: pack.ids,
            index: pack.index,
            data: pack.data,
            playbackKey: 0,
            filaAutores: fila,
            filaAutorIndex: fIdx + 1,
          })
          return
        }
        fecharStoryModal()
        return
      }
      const nextIndex = rawNext
      if (n === 1) {
        setStoryModal((p) => (p ? { ...p, playbackKey: p.playbackKey + 1 } : null))
        return
      }
      const nextId = cur.ids[nextIndex]
      if (nextId === cur.data.id) {
        setStoryModal((p) => (p ? { ...p, index: nextIndex, playbackKey: p.playbackKey + 1 } : null))
        return
      }
      const mapped = await carregarStoryPorId(nextId)
      if (!mapped) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[feed] navegarStory: falha ao carregar story', nextId)
        }
        setStoryModal((p) => (p ? { ...p, playbackKey: p.playbackKey + 1 } : null))
        return
      }
      if (!storyModalRef.current || storyModalRef.current.ids[nextIndex] !== nextId) return
      setStoryModal({
        ids: cur.ids,
        index: nextIndex,
        data: mapped,
        playbackKey: 0,
        filaAutores: fila,
        filaAutorIndex: fIdx,
      })
    },
    [carregarStoryPorId, fecharStoryModal, montarPackStoryAutor]
  )

  const removerPost = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId))
  }

  if (bloqueioEmpresaFeed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-400">Redirecionando…</p>
      </div>
    )
  }

  if (!mounted || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-400">Carregando feed...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-gray-100">
        <StoriesBar
          userEmail={email}
          reloadSignal={storiesBarReload}
          onOpenStory={(id, meta) => void abrirStory(id, meta)}
        />
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
                void (async () => {
                  const mapped = mapRow(raw)
                  const [row] = (await sanearAutoresPostsEmpresaPreview(supabase, [mapped], email, modoAtivo)) as PostFeedRow[]
                  setPosts((prev) => (prev.some((x) => x.id === row.id) ? prev : [row, ...prev]))
                })()
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

      {storyModal ? (
        <StoryViewer
          story={storyModal.data}
          userEmail={email}
          meuUsuarioId={meuId}
          storyQueueLength={storyModal.ids.length}
          storyQueueIndex={storyModal.index}
          timerPlaybackKey={storyModal.playbackKey}
          onVisualizado={bumpStoriesBar}
          onFechar={fecharStoryModal}
          onIrAnterior={() => void navegarStory(-1)}
          onIrProximo={() => void navegarStory(1)}
          onTimerFim={() => void navegarStory(1)}
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
