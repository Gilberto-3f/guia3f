'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import PostCard from '@/components/PostCard'
import AvatarImage from '@/components/AvatarImage'
import { supabase } from '@/lib/supabase'
import { mapPostComAutoresRow } from '@/lib/mapPostComAutoresRow'
import { pickAutorDisplay } from '@/lib/feed-autor'
import { formatarDataRelativaPublicacao } from '@/lib/formatarDataPublicacao'
import { getPerfilHref } from '@/lib/perfil-utils'

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

  const postIdAtivo = ids[indiceAtual] ?? null

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

  useEffect(() => {
    if (!aberto) return
    const html = document.documentElement
    const body = document.body
    const prevHtml = html.style.overflow
    const prevBody = body.style.overflow
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    return () => {
      html.style.overflow = prevHtml
      body.style.overflow = prevBody
    }
  }, [aberto])

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
      setCarregando(true)
      const { data, error } = await supabase.from(POSTS_FEED_VIEW).select('*').eq('id', postIdAtivo).maybeSingle()
      if (!ativo) return
      if (error || !data) {
        setPost(null)
        setCarregando(false)
        return
      }
      const row = /** @type {Record<string, unknown>} */ (data)
      if (row.deleted_at != null) {
        setPost(null)
        setCarregando(false)
        return
      }
      setPost(mapPostComAutoresRow(data))
      setCarregando(false)
    })()
    return () => {
      ativo = false
    }
  }, [aberto, postIdAtivo])

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
    <div className="fixed inset-0 z-[260] flex items-center justify-center px-2 py-4 sm:px-4 sm:py-6 md:px-6">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Fechar" onClick={onFechar} />
      <div
        className="relative z-[1] flex min-h-0 w-full max-w-[min(98.5vw,1152px)] flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        style={{ maxHeight: 'min(92vh, calc(100vh - 2rem))' }}
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
          <div className="flex items-center justify-between gap-2 px-3 py-2">
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
              className="shrink-0 rounded-full p-1 text-gray-500 hover:bg-gray-100"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div
            className="min-h-0 flex-1 overflow-y-auto px-2 pb-4 pt-2 sm:px-4"
            onTouchStart={onTouchStartCarouselNav}
            onTouchEnd={onTouchEndCarouselNav}
            onTouchCancel={onTouchCancelCarouselNav}
          >
            {carregando ? (
              <div className="py-12 text-center text-sm text-gray-400">Carregando publicação…</div>
            ) : !post ? (
              <div className="py-12 text-center text-sm text-gray-500">Esta publicação não está disponível.</div>
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
