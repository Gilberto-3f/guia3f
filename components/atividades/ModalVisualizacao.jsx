'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
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
 *   interacaoUsuario: string
 *   interacaoResumo: string
 *   indiceInicial?: number
 *   comentarioId?: string | null
 * }} props
 */
export default function ModalVisualizacao({
  aberto,
  onFechar,
  postIds,
  interacaoUsuario,
  interacaoResumo,
  indiceInicial = 0,
  comentarioId = null,
}) {
  const idsKey = postIds.map((id) => String(id)).filter(Boolean).join('|')
  const ids = useMemo(() => (idsKey === '' ? [] : idsKey.split('|')), [idsKey])
  const isCarrossel = ids.length > 1

  const [indiceAtual, setIndiceAtual] = useState(0)
  const [post, setPost] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [meuId, setMeuId] = useState(/** @type {string | null} */ (null))
  const [email, setEmail] = useState(/** @type {string | null} */ (null))

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
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
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

  const handlePrev = useCallback(() => {
    setIndiceAtual((i) => Math.max(0, i - 1))
  }, [])

  const handleNext = useCallback(() => {
    setIndiceAtual((i) => Math.min(ids.length - 1, i + 1))
  }, [ids.length])

  if (!aberto) return null

  const destacar = comentarioId != null && comentarioId !== '' ? String(comentarioId) : null
  const u = String(interacaoUsuario || '').replace(/^@/, '')

  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center p-3 sm:p-5">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Fechar" onClick={onFechar} />
      <div
        className="relative z-[1] grid max-h-[85vh] w-full max-w-2xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-xl bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-atividade-titulo"
      >
        <div className="flex shrink-0 items-start gap-2 border-b border-gray-100 px-3 py-2.5 sm:px-4">
          <p id="modal-atividade-titulo" className="min-w-0 flex-1 text-sm leading-snug text-gray-600">
            <span className="font-semibold text-gray-900">@{u}</span>
            {interacaoResumo ? <span className="text-gray-600"> {interacaoResumo}</span> : null}
          </p>
          <button
            type="button"
            onClick={onFechar}
            className="shrink-0 rounded-full p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
          {isCarrossel ? (
            <>
              {indiceAtual > 0 ? (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="absolute left-1 top-1/2 z-[2] -translate-y-1/2 rounded-full bg-white/90 p-1 shadow-md hover:bg-white"
                  aria-label="Foto anterior"
                >
                  <ChevronLeft className="h-4 w-4 text-gray-800" />
                </button>
              ) : null}
              {indiceAtual < ids.length - 1 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="absolute right-1 top-1/2 z-[2] -translate-y-1/2 rounded-full bg-white/90 p-1 shadow-md hover:bg-white"
                  aria-label="Foto seguinte"
                >
                  <ChevronRight className="h-4 w-4 text-gray-800" />
                </button>
              ) : null}
            </>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4 pt-2 sm:px-4">
            {carregando ? (
              <div className="py-12 text-center text-sm text-gray-400">Carregando publicação…</div>
            ) : !post ? (
              <div className="py-12 text-center text-sm text-gray-500">Esta publicação não está disponível.</div>
            ) : (
              <>
                <PostCard
                  post={post}
                  meuUsuarioId={meuId}
                  userEmail={email}
                  storyAtivo={null}
                  onRemove={() => setPost(null)}
                  comentariosInline
                  comentariosSomenteLeitura={false}
                  abrirComentariosInicial={false}
                  destacarComentarioId={destacar}
                />
                {isCarrossel ? (
                  <p className="mt-2 border-t border-gray-100 pt-2 text-center text-xs text-gray-400">
                    {indiceAtual + 1} de {ids.length}
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
