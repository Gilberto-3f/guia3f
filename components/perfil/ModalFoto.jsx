'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, Download, Heart, MessageCircle, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ModalComentarios from '@/components/ModalComentarios'
import ModalCurtidas from '@/components/ModalCurtidas'
import AvatarImage from '@/components/AvatarImage'

/**
 * @typedef {{
 *   id: string
 *   url: string
 *   texto: string | null
 *   total_curtidas: number
 *   total_comentarios: number
 * }} FotoPostItem
 */

/**
 * @param {{
 *   posts: FotoPostItem[]
 *   indiceInicial: number
 *   aberto: boolean
 *   onFechar: () => void
 *   meuUsuarioId: string | null
 *   autor: { nome: string, username: string, foto_perfil_url: string | null }
 *   onPatchPost?: (postId: string, patch: Partial<Pick<FotoPostItem, 'total_curtidas' | 'total_comentarios'>>) => void
 * }} props
 */
export default function ModalFoto({ posts, indiceInicial, aberto, onFechar, meuUsuarioId, autor, onPatchPost }) {
  const [i, setI] = useState(indiceInicial)
  const [touchX, setTouchX] = useState(/** @type {number | null} */ (null))
  const [comentAberto, setComentAberto] = useState(false)
  const [curtidasAberto, setCurtidasAberto] = useState(false)
  const [curtiu, setCurtiu] = useState(false)
  const [curtLocal, setCurtLocal] = useState(0)
  const [comentLocal, setComentLocal] = useState(0)

  const post = posts[i]

  useEffect(() => {
    if (aberto) setI(Math.min(Math.max(0, indiceInicial), Math.max(0, posts.length - 1)))
  }, [aberto, indiceInicial, posts.length])

  useEffect(() => {
    if (!post) return
    setCurtLocal(post.total_curtidas ?? 0)
    setComentLocal(post.total_comentarios ?? 0)
  }, [post?.id, post?.total_curtidas, post?.total_comentarios])

  useEffect(() => {
    if (!aberto || !post?.id || !meuUsuarioId) {
      setCurtiu(false)
      return
    }
    void supabase
      .from('curtidas')
      .select('id')
      .eq('post_id', post.id)
      .eq('usuario_id', meuUsuarioId)
      .maybeSingle()
      .then(({ data }) => setCurtiu(Boolean(data)))
  }, [aberto, post?.id, meuUsuarioId])

  const prev = useCallback(() => {
    setI((x) => (x > 0 ? x - 1 : posts.length - 1))
  }, [posts.length])

  const next = useCallback(() => {
    setI((x) => (x < posts.length - 1 ? x + 1 : 0))
  }, [posts.length])

  useEffect(() => {
    if (!aberto) return
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'Escape') onFechar()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [aberto, prev, next, onFechar])

  const baixar = async () => {
    const url = post?.url
    if (!url) return
    try {
      const r = await fetch(url)
      const blob = await r.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `foto-${i + 1}.jpg`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      window.open(url, '_blank')
    }
  }

  const handleCurtir = async () => {
    if (!meuUsuarioId || !post) return
    if (curtiu) {
      await supabase.from('curtidas').delete().eq('post_id', post.id).eq('usuario_id', meuUsuarioId)
      setCurtiu(false)
      setCurtLocal((t) => {
        const n = Math.max(0, t - 1)
        onPatchPost?.(post.id, { total_curtidas: n })
        return n
      })
    } else {
      const { error } = await supabase.from('curtidas').insert({ post_id: post.id, usuario_id: meuUsuarioId })
      if (error) return
      setCurtiu(true)
      setCurtLocal((t) => {
        const n = t + 1
        onPatchPost?.(post.id, { total_curtidas: n })
        return n
      })
    }
  }

  if (!aberto || posts.length === 0 || !post) return null

  const url = post.url

  return (
    <div className="fixed inset-0 z-[220] flex flex-col bg-white">
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-3 py-2 text-gray-900">
        <span className="text-sm font-medium">
          {i + 1}/{posts.length}
        </span>
        <div className="flex gap-1">
          <button type="button" onClick={() => void baixar()} className="rounded-full p-2 text-gray-600 hover:bg-gray-100" aria-label="Download">
            <Download size={22} />
          </button>
          <button type="button" onClick={onFechar} className="rounded-full p-2 text-gray-600 hover:bg-gray-100" aria-label="Fechar">
            <X size={22} />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div
          className="relative min-h-0 flex-1 touch-pan-y bg-black"
          onTouchStart={(e) => setTouchX(e.touches[0]?.clientX ?? null)}
          onTouchEnd={(e) => {
            if (touchX == null) return
            const end = e.changedTouches[0]?.clientX ?? touchX
            const d = end - touchX
            if (d > 50) prev()
            if (d < -50) next()
            setTouchX(null)
          }}
        >
          <div className="relative h-full w-full">
            <Image src={url} alt="" fill className="object-contain" sizes="100vw" />
          </div>
          {posts.length > 1 ? (
            <>
              <button
                type="button"
                onClick={prev}
                className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/40 p-2 text-white md:block"
                aria-label="Anterior"
              >
                <ChevronLeft size={28} />
              </button>
              <button
                type="button"
                onClick={next}
                className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/40 p-2 text-white md:block"
                aria-label="Próxima"
              >
                <ChevronRight size={28} />
              </button>
            </>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-gray-100 bg-white px-3 pt-2">
          <div className="flex items-start gap-3 pb-2">
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md bg-gray-100">
              <AvatarImage src={autor.foto_perfil_url} alt="" width={36} height={36} className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800">@{autor.username}</p>
              <p className="text-xs text-gray-400">{autor.nome}</p>
            </div>
          </div>

          <div className="flex w-full items-center justify-around border-t border-gray-50 px-1 py-2">
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => void handleCurtir()}
                disabled={!meuUsuarioId}
                className="flex items-center p-1 text-gray-800 disabled:opacity-50"
                aria-label="Curtir"
              >
                <Heart className={`h-5 w-5 shrink-0 ${curtiu ? 'fill-red-500 text-red-500' : 'text-gray-500'}`} />
              </button>
              <button
                type="button"
                onClick={() => setCurtidasAberto(true)}
                className="min-w-[1.25rem] text-sm text-gray-800"
              >
                {curtLocal}
              </button>
            </div>
            <button type="button" onClick={() => setComentAberto(true)} className="flex items-center gap-1 text-sm text-gray-800">
              <MessageCircle className="h-5 w-5 shrink-0 text-gray-500" />
              <span>{comentLocal}</span>
            </button>
          </div>

          {post.texto ? <p className="border-t border-gray-50 px-1 py-2 text-sm text-gray-800">{post.texto}</p> : null}
        </div>

        <div className="scrollbar-perfil flex gap-1 overflow-x-auto border-t border-gray-100 bg-white p-2">
          {posts.map((p, idx) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setI(idx)}
              className={`relative h-14 w-14 shrink-0 overflow-hidden rounded border-2 ${idx === i ? 'border-[#0097b2]' : 'border-transparent opacity-70'}`}
            >
              <Image src={p.url} alt="" fill className="object-cover" sizes="56px" />
            </button>
          ))}
        </div>
      </div>

      <ModalComentarios
        postId={post.id}
        aberto={comentAberto}
        onFechar={() => setComentAberto(false)}
        usuarioId={meuUsuarioId}
        onComentou={() => {
          setComentLocal((n) => {
            const v = n + 1
            onPatchPost?.(post.id, { total_comentarios: v })
            return v
          })
        }}
      />
      <ModalCurtidas postId={post.id} aberto={curtidasAberto} onFechar={() => setCurtidasAberto(false)} meuUsuarioId={meuUsuarioId} />
    </div>
  )
}
