'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, X } from 'lucide-react'
import PostCard from '@/components/PostCard'
import AvatarImage from '@/components/AvatarImage'
import { supabase } from '@/lib/supabase'
import { mapPostComAutoresRow } from '@/lib/mapPostComAutoresRow'
import { pickAutorDisplay } from '@/lib/feed-autor'
import { formatarDataRelativaPublicacao } from '@/lib/formatarDataPublicacao'
import { getPerfilHref } from '@/lib/perfil-utils'
import { useModalScrollLock } from '@/lib/useModalScrollLock'

const POSTS_FEED_VIEW = 'posts_com_autores'

/**
 * Modal centrado com publicação completa (PostCard + comentários inline).
 *
 * @param {{
 *   aberto: boolean
 *   onFechar: () => void
 *   postIds: string[]
 *   interacaoUsuario?: string
 *   interacaoResumo?: string
 *   indiceInicial?: number
 *   comentarioId?: string | null
 *   thumbUrls?: string[] | null
 * }} props
 */
export default function ModalVisualizacao({
  aberto,
  onFechar,
  postIds,
  interacaoUsuario: _interacaoUsuario,
  interacaoResumo: _interacaoResumo,
  indiceInicial = 0,
  comentarioId = null,
  thumbUrls = null,
}) {
  const idsKey = postIds.map((id) => String(id)).filter(Boolean).join('|')
  const ids = useMemo(() => (idsKey === '' ? [] : idsKey.split('|')), [idsKey])
  const isCarrossel = ids.length > 1

  const [indiceAtual, setIndiceAtual] = useState(0)
  const [post, setPost] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [meuId, setMeuId] = useState(/** @type {string | null} */ (null))
  const [email, setEmail] = useState(/** @type {string | null} */ (null))
  const [thumbs, setThumbs] = useState(/** @type {(string | null)[]} */ ([]))
  const [autorOriginalUsername, setAutorOriginalUsername] = useState(/** @type {string | null} */ (null))
  const [autorOriginalUsuarioId, setAutorOriginalUsuarioId] = useState(/** @type {string | null} */ (null))
  const [autorOriginalEmpresaId, setAutorOriginalEmpresaId] = useState(/** @type {string | null} */ (null))
  const [autorOriginalRole, setAutorOriginalRole] = useState(/** @type {string | null} */ (null))

  /** Deslize horizontal no miolo do modal para mudar de foto (carrossel). */
  const swipeRef = useRef({ x: 0, y: 0, active: false })
  const postCacheRef = useRef(/** @type {Map<string, ReturnType<typeof mapPostComAutoresRow> | null>} */ (new Map()))

  const postIdAtivo = ids[indiceAtual] ?? null

  const carregarPostPorId = useCallback(async (postId) => {
    const id = String(postId ?? '')
    if (!id) return null
    if (postCacheRef.current.has(id)) return postCacheRef.current.get(id) ?? null

    const { data, error } = await supabase.from(POSTS_FEED_VIEW).select('*').eq('id', id).maybeSingle()
    if (error || !data) {
      postCacheRef.current.set(id, null)
      return null
    }
    const row = /** @type {Record<string, unknown>} */ (data)
    if (row.deleted_at != null) {
      postCacheRef.current.set(id, null)
      return null
    }
    const mapped = mapPostComAutoresRow(data)
    postCacheRef.current.set(id, mapped)
    return mapped
  }, [])

  const onTouchStartCarouselNav = useCallback(
    (e) => {
      if (!isCarrossel || ids.length < 2) return
      const t = e.touches[0]
      if (!t) return
      swipeRef.current = { x: t.clientX, y: t.clientY, active: true }
    },
    [isCarrossel, ids.length]
  )

  const onTouchEndCarouselNav = useCallback(
    (e) => {
      if (!isCarrossel || ids.length < 2 || !swipeRef.current.active) return
      swipeRef.current.active = false
      const t = e.changedTouches[0]
      if (!t) return
      const dx = t.clientX - swipeRef.current.x
      const dy = t.clientY - swipeRef.current.y
      if (Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy)) return
      if (dx < 0) {
        setIndiceAtual((i) => Math.min(ids.length - 1, i + 1))
      } else {
        setIndiceAtual((i) => Math.max(0, i - 1))
      }
    },
    [isCarrossel, ids.length]
  )

  const onTouchCancelCarouselNav = useCallback(() => {
    swipeRef.current.active = false
  }, [])

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setMeuId(session?.user?.id ?? null)
      setEmail(session?.user?.email ?? null)
    })
  }, [])

  useEffect(() => {
    if (!aberto || ids.length === 0) return
    const i = Math.min(Math.max(0, indiceInicial), ids.length - 1)
    setIndiceAtual(i)
  }, [aberto, indiceInicial, ids.length, idsKey])

  useModalScrollLock(aberto)

  useEffect(() => {
    if (!aberto) return
    const onKey = (e) => {
      if (e.key === 'Escape') onFechar()
      if (isCarrossel && ids.length > 1) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          setIndiceAtual((i) => Math.max(0, i - 1))
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          setIndiceAtual((i) => Math.min(ids.length - 1, i + 1))
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [aberto, onFechar, isCarrossel, ids.length])

  useEffect(() => {
    if (!aberto || !postIdAtivo) {
      setPost(null)
      setCarregando(false)
      return
    }
    let ativo = true
    void (async () => {
      const cached = postCacheRef.current.get(postIdAtivo)
      if (cached !== undefined) {
        setPost(cached)
        setCarregando(false)
        return
      }

      setCarregando(true)
      setPost(null)
      const mapped = await carregarPostPorId(postIdAtivo)
      if (!ativo) return
      setPost(mapped)
      setCarregando(false)
    })()
    return () => {
      ativo = false
    }
  }, [aberto, postIdAtivo, carregarPostPorId])

  useEffect(() => {
    if (!aberto || !isCarrossel || ids.length < 2) return
    const proximos = [indiceAtual + 1, indiceAtual - 1].filter((i) => i >= 0 && i < ids.length)
    for (const i of proximos) {
      const id = ids[i]
      if (id && !postCacheRef.current.has(id)) {
        void carregarPostPorId(id)
      }
    }
  }, [aberto, carregarPostPorId, ids, indiceAtual, isCarrossel])

  useEffect(() => {
    if (!aberto || !isCarrossel) return
    const urls = [thumbs[indiceAtual + 1], thumbs[indiceAtual - 1], thumbs[indiceAtual]]
      .map((u) => (u != null ? String(u).trim() : ''))
      .filter(Boolean)
    for (const url of urls) {
      const img = new window.Image()
      img.decoding = 'async'
      img.src = url
    }
  }, [aberto, thumbs, indiceAtual, isCarrossel])

  useEffect(() => {
    const postOriginalId =
      post?.post_original_id != null && post.post_original_id !== '' ? String(post.post_original_id) : null
    if (!postOriginalId) {
      setAutorOriginalUsername(null)
      setAutorOriginalUsuarioId(null)
      setAutorOriginalEmpresaId(null)
      setAutorOriginalRole(null)
      return
    }
    let cancel = false
    void supabase
      .from(POSTS_FEED_VIEW)
      .select('*')
      .eq('id', postOriginalId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancel || error || !data) {
          return
        }
        const p = /** @type {Record<string, unknown>} */ (data)
        const rawU = p.usuarios
        let u = rawU
        if (typeof rawU === 'string') {
          try {
            u = JSON.parse(rawU)
          } catch {
            u = null
          }
        }
        const a = pickAutorDisplay(u)
        setAutorOriginalUsername(a.username || null)
        setAutorOriginalUsuarioId(a.usuario_id ? String(a.usuario_id) : null)
        setAutorOriginalEmpresaId(a.empresa_id ? String(a.empresa_id) : null)
        setAutorOriginalRole(a.role ? String(a.role) : null)
      })
    return () => {
      cancel = true
    }
  }, [post?.id, post?.post_original_id])

  useEffect(() => {
    if (!aberto || !isCarrossel) {
      setThumbs([])
      return
    }
    const fromProp = thumbUrls && thumbUrls.length === ids.length
    if (fromProp) {
      setThumbs(thumbUrls.map((u) => (u != null && String(u).trim() !== '' ? String(u) : null)))
      return
    }
    let cancel = false
    void (async () => {
      const { data, error } = await supabase.from('posts').select('id, foto_url, conteudo_url').in('id', ids)
      if (cancel) return
      if (error || !data) {
        setThumbs(ids.map(() => null))
        return
      }
      const byId = new Map(
        data.map((r) => {
          const row = /** @type {Record<string, unknown>} */ (r)
          const id = String(row.id ?? '')
          const url =
            row.conteudo_url != null && String(row.conteudo_url).trim() !== ''
              ? String(row.conteudo_url)
              : row.foto_url != null && String(row.foto_url).trim() !== ''
                ? String(row.foto_url)
                : null
          return [id, url]
        })
      )
      setThumbs(ids.map((id) => byId.get(id) ?? null))
    })()
    return () => {
      cancel = true
    }
  }, [aberto, isCarrossel, ids, idsKey, thumbUrls])

  if (!aberto) return null

  const destacar = comentarioId != null && comentarioId !== '' ? String(comentarioId) : null

  const postOriginalId =
    post?.post_original_id != null && post.post_original_id !== '' ? String(post.post_original_id) : null
  const ehRepost = Boolean(postOriginalId)
  const tipoNorm = String(post?.tipo || '').toLowerCase()
  const repostEhFoto = tipoNorm === 'foto' || tipoNorm === 'misto'
  const autorId = post?.autor?.usuario_id || ''
  const hrefAutor = autorId
    ? getPerfilHref({ usuario_id: autorId, role: post?.autor?.role, empresa_id: post?.autor?.empresa_id || null })
    : ''
  const isSelfRepost =
    ehRepost && Boolean(autorId && autorOriginalUsuarioId && String(autorId) === String(autorOriginalUsuarioId))
  const hrefAutorOriginal = autorOriginalUsuarioId
    ? getPerfilHref({
        usuario_id: autorOriginalUsuarioId,
        role: autorOriginalRole ?? undefined,
        empresa_id: autorOriginalEmpresaId,
      })
    : ''

  return (
    <div className="fixed inset-0 z-[260] flex flex-col bg-black/50 sm:items-center sm:justify-center sm:px-4 sm:py-6 md:px-6">
      <button
        type="button"
        className="w-full shrink-0 sm:hidden"
        style={{ height: 'max(3.25rem, calc(env(safe-area-inset-top) + 2.75rem))' }}
        aria-label="Fechar"
        onClick={onFechar}
      />
      <button type="button" className="absolute inset-0 hidden sm:block" aria-label="Fechar" onClick={onFechar} />
      <div
        className="relative z-[1] flex min-h-0 w-full max-w-[min(98.5vw,1152px)] flex-1 flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-h-[min(85vh,calc(100vh-2rem))] sm:flex-none sm:rounded-xl"
        style={isCarrossel ? { height: 'auto' } : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-atividade-titulo"
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerMove={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        <span id="modal-atividade-titulo" className="sr-only">
          Publicação
        </span>
        <div className="sticky top-0 z-10 shrink-0 border-b border-gray-100 bg-white">
          {!carregando && post && ehRepost ? (
            <div className="border-b border-gray-50 px-3 pb-1.5 pt-2">
              <p className="text-xs leading-snug text-gray-600">
                {autorId ? (
                  <Link href={hrefAutor} className="font-semibold text-gray-800 hover:text-[#0097b2]">
                    @{post.autor?.username ?? ''}
                  </Link>
                ) : (
                  <span className="font-semibold text-gray-800">@{post.autor?.username ?? ''}</span>
                )}
                {isSelfRepost ? (
                  <span>{repostEhFoto ? ' repostou uma foto' : ' repostou um post'}</span>
                ) : (
                  <>
                    <span>{repostEhFoto ? ' repostou foto de ' : ' repostou post de '}</span>
                    {autorOriginalUsername ? (
                      autorOriginalUsuarioId ? (
                        <Link
                          href={hrefAutorOriginal}
                          className="font-semibold text-gray-800 hover:text-[#0097b2]"
                        >
                          @{autorOriginalUsername}
                        </Link>
                      ) : (
                        <span className="font-semibold text-gray-800">@{autorOriginalUsername}</span>
                      )
                    ) : (
                      <span className="font-medium text-gray-400" aria-hidden>
                        @…
                      </span>
                    )}
                  </>
                )}
              </p>
            </div>
          ) : null}
          <div className="flex items-center gap-2 px-3 py-2">
            <button
              type="button"
              onClick={onFechar}
              className="inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded-lg px-1 text-sm font-medium text-gray-800 hover:bg-gray-100 sm:hidden"
              aria-label="Voltar"
            >
              <ChevronLeft className="h-5 w-5 shrink-0" aria-hidden />
              Voltar
            </button>
            {!carregando && post ? (
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {post.autor?.usuario_id ? (
                  <Link
                    href={hrefAutor}
                    className="relative block h-9 w-9 shrink-0 overflow-hidden rounded-md bg-gray-100"
                    aria-label={`Perfil de @${post.autor?.username ?? 'usuario'}`}
                  >
                    <AvatarImage
                      src={post.autor?.foto_perfil_url}
                      alt=""
                      width={36}
                      height={36}
                      className="h-full w-full object-cover"
                    />
                  </Link>
                ) : (
                  <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md bg-gray-100">
                    <AvatarImage
                      src={post.autor?.foto_perfil_url}
                      alt=""
                      width={36}
                      height={36}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  {post.autor?.usuario_id ? (
                    <Link
                      href={hrefAutor}
                      className="block truncate text-sm font-semibold text-gray-900 hover:text-[#0097b2]"
                    >
                      @{post.autor?.username ?? ''}
                    </Link>
                  ) : (
                    <p className="truncate text-sm font-semibold text-gray-900">@{post.autor?.username ?? ''}</p>
                  )}
                  <p className="text-xs text-gray-500">{formatarDataRelativaPublicacao(post.created_at)}</p>
                </div>
              </div>
            ) : (
              <div className="min-h-[36px] min-w-0 flex-1" aria-hidden />
            )}
            <button
              type="button"
              onClick={onFechar}
              className="ml-auto shrink-0 rounded-full p-2 text-gray-500 hover:bg-gray-100 sm:p-1"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div
            className="min-h-0 flex-1 overflow-y-auto px-2 pb-4 pt-2 sm:px-4"
            data-modal-scroll-lock-scrollable
            onTouchStart={onTouchStartCarouselNav}
            onTouchEnd={onTouchEndCarouselNav}
            onTouchCancel={onTouchCancelCarouselNav}
          >
            {carregando ? (
              <div
                className={`flex ${isCarrossel ? 'min-h-[40vh] sm:min-h-[70vh]' : 'min-h-[200px] sm:min-h-[240px]'} items-center justify-center rounded-xl bg-gray-50`}
              >
                <div className="h-72 w-full max-w-md animate-pulse rounded-xl bg-gray-200" aria-hidden />
                <span className="sr-only">Carregando publicação…</span>
              </div>
            ) : !post ? (
              <div
                className={`flex ${isCarrossel ? 'min-h-[40vh] sm:min-h-[70vh]' : 'min-h-[200px] sm:min-h-[240px]'} items-center justify-center text-sm text-gray-500`}
              >
                Esta publicação não está disponível.
              </div>
            ) : (
              <PostCard
                post={post}
                meuUsuarioId={meuId}
                userEmail={email}
                storyAtivo={null}
                onRemove={() => setPost(null)}
                comentariosInline
                compositorComentarioAteClique
                comentariosSomenteLeitura={false}
                abrirComentariosInicial={false}
                destacarComentarioId={destacar}
                ocultarCabecalhoCard
                suprimirNotificacaoAtividades
              />
            )}
          </div>

          {isCarrossel ? (
            <div className="shrink-0 overflow-x-auto border-t border-gray-100 bg-white py-2">
              <div className="flex justify-center gap-2 px-4">
                {ids.map((id, idx) => {
                  const url = thumbs[idx] ?? null
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setIndiceAtual(idx)}
                      className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-md ${
                        idx === indiceAtual ? 'ring-2 ring-[#0097b2] ring-offset-1' : 'opacity-70 hover:opacity-100'
                      }`}
                      aria-label={`Ver publicação ${idx + 1} de ${ids.length}`}
                      aria-current={idx === indiceAtual ? 'true' : undefined}
                    >
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- URLs arbitrários do storage
                        <img src={url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full bg-gray-200" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
