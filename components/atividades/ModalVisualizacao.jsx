'use client'

import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import PostCard from '@/components/PostCard'
import { supabase } from '@/lib/supabase'
import { mapPostComAutoresRow } from '@/lib/mapPostComAutoresRow'

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

  const postIdAtivo = ids[indiceAtual] ?? null

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
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [aberto, onFechar])

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

  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center px-2 py-4 sm:px-4 sm:py-6 md:px-6">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Fechar" onClick={onFechar} />
      <div
        className="relative z-[1] flex min-h-0 w-full max-w-[min(98.5vw,1152px)] flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        style={{ maxHeight: 'min(92vh, calc(100vh - 2rem))' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-atividade-titulo"
      >
        <span id="modal-atividade-titulo" className="sr-only">
          Publicação
        </span>
        <div className="sticky top-0 z-10 flex shrink-0 justify-end border-b border-gray-100 bg-white p-3">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4 pt-2 sm:px-4">
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
