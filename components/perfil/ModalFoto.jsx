'use client'

import { useEffect, useMemo, useRef } from 'react'
import { ChevronLeft } from 'lucide-react'
import PostCard from '@/components/PostCard'

/**
 * @typedef {{
 *   id: string
 *   url: string
 *   texto: string | null
 *   created_at: string
 *   tipo?: string | null
 *   total_curtidas: number
 *   total_comentarios: number
 *   total_compartilhamentos?: number
 *   total_reposts?: number
 *   post_original_id?: string | null
 * }} FotoPostItem
 */

/**
 * @param {{
 *   posts: FotoPostItem[]
 *   indiceInicial: number
 *   aberto: boolean
 *   onFechar: () => void
 *   meuUsuarioId: string | null
 *   autor: {
 *     nome: string
 *     username: string
 *     foto_perfil_url: string | null
 *     usuario_id: string
 *     role?: string | null
 *   }
 *   onPatchPost?: (postId: string, patch: Partial<Pick<FotoPostItem, 'total_curtidas' | 'total_comentarios'>>) => void
 *   onRemovePost?: (postId: string) => void
 * }} props
 */
export default function ModalFoto({ posts, indiceInicial, aberto, onFechar, meuUsuarioId, autor, onPatchPost, onRemovePost }) {
  const scrollRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const jaScrollou = useRef(false)

  const cards = useMemo(() => {
    return posts.map((p) => ({
      post: {
        id: p.id,
        tipo: p.tipo && String(p.tipo) ? String(p.tipo) : 'foto',
        texto: p.texto,
        foto_url: p.url,
        conteudo_url: p.url,
        total_curtidas: p.total_curtidas ?? 0,
        total_comentarios: p.total_comentarios ?? 0,
        total_compartilhamentos: p.total_compartilhamentos ?? 0,
        total_reposts: p.total_reposts ?? 0,
        avaliacao_meta: null,
        created_at: p.created_at,
        post_original_id: p.post_original_id != null && p.post_original_id !== '' ? String(p.post_original_id) : null,
        autor: {
          nome: autor.nome,
          username: autor.username,
          foto_perfil_url: autor.foto_perfil_url,
          usuario_id: autor.usuario_id,
          empresa_id: '',
          role: autor.role && String(autor.role) ? String(autor.role) : 'turista',
        },
      },
    }))
  }, [posts, autor])

  useEffect(() => {
    if (!aberto) {
      jaScrollou.current = false
      return
    }
    const i = Math.min(Math.max(0, indiceInicial), Math.max(0, posts.length - 1))
    const alvo = posts[i]?.id
    if (!alvo || jaScrollou.current) return
    const t = window.setTimeout(() => {
      document.getElementById(`feed-post-${alvo}`)?.scrollIntoView({ behavior: 'auto', block: 'start' })
      jaScrollou.current = true
    }, 80)
    return () => clearTimeout(t)
  }, [aberto, indiceInicial, posts])

  if (!aberto || posts.length === 0) return null

  return (
    <div className="fixed inset-0 z-[220] flex flex-col bg-gray-50">
      <header className="sticky top-0 z-10 flex shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-3 py-2">
        <button
          type="button"
          onClick={onFechar}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100"
          aria-label="Voltar"
        >
          <ChevronLeft className="h-5 w-5 shrink-0" aria-hidden />
          Voltar
        </button>
      </header>

      <div ref={scrollRef} className="scrollbar-perfil min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="space-y-4 p-4 pb-8">
          {cards.map(({ post }) => (
            <PostCard
              key={post.id}
              post={post}
              meuUsuarioId={meuUsuarioId}
              userEmail={null}
              storyAtivo={null}
              onRemove={(postId) => {
                onRemovePost?.(postId)
                if (posts.filter((x) => x.id !== postId).length === 0) onFechar()
              }}
              onEngagementChange={(postId, patch) => onPatchPost?.(postId, patch)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
