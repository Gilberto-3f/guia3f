'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import BotaoCurtir from '@/components/BotaoCurtir'
import BotaoComentar from '@/components/BotaoComentar'
import BotaoCompartilhar from '@/components/BotaoCompartilhar'
import BotaoSalvar from '@/components/BotaoSalvar'
import ModalComentarios from '@/components/ModalComentarios'
import ModalCompartilhar from '@/components/ModalCompartilhar'
import MenuPost from '@/components/MenuPost'
import AvaliacaoCard from '@/components/AvaliacaoCard'
import { supabase } from '@/lib/supabase'
import { STORY_RING_GRADIENT, emailVisualizouStory } from '@/lib/feed-autor'
import AvatarImage from '@/components/AvatarImage'

/**
 * @param {{
 *   post: {
 *     id: string
 *     tipo: string
 *     texto: string | null
 *     foto_url: string | null
 *     conteudo_url: string | null
 *     total_curtidas: number
 *     total_comentarios: number
 *     total_compartilhamentos: number
 *     avaliacao_meta: Record<string, unknown> | null
 *     created_at: string
 *     autor: { nome: string, username: string, foto_perfil_url: string | null, usuario_id: string, empresa_id: string, role: string }
 *   }
 *   meuUsuarioId: string | null
 *   userEmail?: string | null
 *   storyAtivo?: { id: string, visualizado_por: unknown } | null
 *   onAbrirStory?: (storyId: string) => void
 *   onRemove?: (postId: string) => void
 *   abrirComentariosInicial?: boolean
 *   destacarComentarioId?: string | null
 * }} props
 */
export default function PostCard({
  post,
  meuUsuarioId,
  userEmail = null,
  storyAtivo = null,
  onAbrirStory,
  onRemove,
  abrirComentariosInicial = false,
  destacarComentarioId = null,
}) {
  const [comentAberto, setComentAberto] = useState(false)
  const deepLinkComentAberto = useRef(/** @type {string | null} */ (null))
  const [shareAberto, setShareAberto] = useState(false)
  const [nComent, setNComent] = useState(post.total_comentarios ?? 0)
  const [shareTotal, setShareTotal] = useState(post.total_compartilhamentos ?? 0)
  const [jaSegueEmpresa, setJaSegueEmpresa] = useState(false)
  const [jaSegueUsuario, setJaSegueUsuario] = useState(false)
  const [tickSeguir, setTickSeguir] = useState(0)

  const empresaId = post.autor?.empresa_id || ''
  const autorId = post.autor?.usuario_id || ''

  const mostrarSeguirUsuario =
    Boolean(!empresaId && meuUsuarioId && autorId && autorId !== meuUsuarioId)

  const seguidoTipo = post.autor?.role || 'turista'

  const usuarioAlvo = useMemo(() => {
    if (!mostrarSeguirUsuario) return null
    return { seguidoId: autorId, seguidoTipo, jaSegue: jaSegueUsuario }
  }, [mostrarSeguirUsuario, autorId, seguidoTipo, jaSegueUsuario])

  useEffect(() => {
    setNComent(post.total_comentarios ?? 0)
  }, [post.total_comentarios, post.id])

  useEffect(() => {
    if (!abrirComentariosInicial) {
      deepLinkComentAberto.current = null
      return
    }
    const key = `${post.id}:${destacarComentarioId ?? ''}`
    if (deepLinkComentAberto.current === key) return
    deepLinkComentAberto.current = key
    setComentAberto(true)
  }, [abrirComentariosInicial, post.id, destacarComentarioId])

  useEffect(() => {
    setShareTotal(post.total_compartilhamentos ?? 0)
  }, [post.total_compartilhamentos, post.id])

  useEffect(() => {
    if (!empresaId || !meuUsuarioId) {
      setJaSegueEmpresa(false)
      return
    }
    void supabase
      .from('favoritos')
      .select('id')
      .eq('usuario_id', meuUsuarioId)
      .eq('empresa_id', empresaId)
      .maybeSingle()
      .then(({ data }) => setJaSegueEmpresa(Boolean(data)))
  }, [empresaId, meuUsuarioId, tickSeguir])

  useEffect(() => {
    if (!mostrarSeguirUsuario || !meuUsuarioId) {
      setJaSegueUsuario(false)
      return
    }
    void supabase
      .from('redecontatos')
      .select('id')
      .eq('seguidor_id', meuUsuarioId)
      .eq('seguido_id', autorId)
      .maybeSingle()
      .then(({ data }) => setJaSegueUsuario(Boolean(data)))
  }, [mostrarSeguirUsuario, meuUsuarioId, autorId, tickSeguir])

  const mediaUrl = post.conteudo_url || post.foto_url
  const hasMedia = Boolean(mediaUrl)
  const tipoNorm = String(post.tipo || '').toLowerCase()

  const temStoryNoAutor = Boolean(storyAtivo?.id)
  const storyDoAutorVisto = temStoryNoAutor ? emailVisualizouStory(storyAtivo?.visualizado_por, userEmail) : true

  const resumo = (post.texto || 'Publicação').slice(0, 80)
  const postUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/feed?post=${encodeURIComponent(post.id)}` : ''

  const menuProps = {
    postId: post.id,
    autorUsuarioId: post.autor?.usuario_id,
    meuUsuarioId,
    empresaAlvo: empresaId ? { empresaId, jaSegue: jaSegueEmpresa } : null,
    usuarioAlvo,
    onApagou: () => onRemove?.(post.id),
    onSeguiuEmpresa: () => setTickSeguir((t) => t + 1),
    onSeguiuUsuario: () => setTickSeguir((t) => t + 1),
  }

  const shareModal = (
    <ModalCompartilhar
      aberto={shareAberto}
      onFechar={() => setShareAberto(false)}
      postUrl={postUrl}
      postId={post.id}
      tituloResumo={resumo}
      usuarioId={meuUsuarioId}
      onCompartilhouFeed={() => setShareTotal((n) => n + 1)}
    />
  )

  const acoesPost = (
    <div className="flex items-center justify-between gap-4 px-3 py-2">
      <div className="flex flex-1 items-center justify-start gap-6">
        <BotaoCurtir postId={post.id} totalInicial={post.total_curtidas ?? 0} usuarioId={meuUsuarioId} />
        <BotaoComentar total={nComent} onClick={() => setComentAberto(true)} />
        <BotaoCompartilhar total={shareTotal} onClick={() => setShareAberto(true)} />
      </div>
      <div className="shrink-0 pl-2">
        <BotaoSalvar postId={post.id} usuarioId={meuUsuarioId} />
      </div>
    </div>
  )

  if (tipoNorm === 'avaliacao' && post.avaliacao_meta && typeof post.avaliacao_meta === 'object') {
    const meta = /** @type {{ empresa_id?: string, nome_fantasia?: string, foto_url?: string | null, nota?: number, feedback?: string | null }} */ (
      post.avaliacao_meta
    )
    const tempo = new Date(post.created_at).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    return (
      <article id={`feed-post-${post.id}`} className="rounded-xl bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-50 px-4 pt-3">
          <div>
            <p className="text-sm font-semibold text-gray-800">@{post.autor?.username ?? ''}</p>
            <time className="text-xs text-gray-400">{tempo}</time>
          </div>
          <MenuPost {...menuProps} />
        </div>
        <div className="p-4 pt-3">
          <AvaliacaoCard meta={meta} />
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-gray-100 px-3 py-2">
          <div className="flex flex-1 items-center justify-start gap-6">
            <BotaoCurtir postId={post.id} totalInicial={post.total_curtidas ?? 0} usuarioId={meuUsuarioId} />
            <BotaoComentar total={nComent} onClick={() => setComentAberto(true)} />
            <BotaoCompartilhar total={shareTotal} onClick={() => setShareAberto(true)} />
          </div>
          <div className="shrink-0 pl-2">
            <BotaoSalvar postId={post.id} usuarioId={meuUsuarioId} />
          </div>
        </div>
        <ModalComentarios
          postId={post.id}
          aberto={comentAberto}
          onFechar={() => setComentAberto(false)}
          usuarioId={meuUsuarioId}
          onComentou={() => setNComent((n) => n + 1)}
          destacarComentarioId={destacarComentarioId}
        />
        {shareModal}
      </article>
    )
  }

  return (
    <article id={`feed-post-${post.id}`} className="overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="flex items-center justify-between p-4 pb-2">
        <div className="flex items-start gap-3">
          {temStoryNoAutor ? (
            <div
              className={`relative shrink-0 rounded-md p-[2px] ${storyDoAutorVisto ? 'bg-gray-300' : ''}`}
              style={!storyDoAutorVisto ? { background: STORY_RING_GRADIENT } : undefined}
            >
              <button
                type="button"
                className="relative block h-12 w-12 overflow-hidden rounded-md bg-gray-100 p-0"
                onClick={() => storyAtivo?.id && onAbrirStory?.(storyAtivo.id)}
                aria-label={`Story de ${post.autor?.nome ?? 'autor'}`}
              >
                <AvatarImage
                  src={post.autor?.foto_perfil_url}
                  alt=""
                  width={48}
                  height={48}
                  className="h-full w-full object-cover"
                />
              </button>
            </div>
          ) : (
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-gray-100">
              <AvatarImage
                src={post.autor?.foto_perfil_url}
                alt=""
                width={48}
                height={48}
                className="object-cover"
              />
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-gray-800">@{post.autor?.username ?? ''}</p>
            <time className="mt-0.5 block text-xs text-gray-400">
              {new Date(post.created_at).toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </time>
          </div>
        </div>
        <MenuPost {...menuProps} />
      </div>

      {hasMedia ? (
        <>
          <div className="relative aspect-[4/3] w-full bg-gray-100">
            <Image src={mediaUrl} alt="" fill className="object-cover" sizes="(max-width: 768px) 100vw, 480px" />
          </div>
          {acoesPost}
          {post.texto ? <p className="px-4 pb-3 pt-1 text-sm text-gray-800">{post.texto}</p> : null}
        </>
      ) : (
        <>
          {post.texto ? <p className="px-4 py-2 pt-0 text-sm text-gray-800">{post.texto}</p> : null}
          {acoesPost}
        </>
      )}

      <ModalComentarios
        postId={post.id}
        aberto={comentAberto}
        onFechar={() => setComentAberto(false)}
        usuarioId={meuUsuarioId}
        onComentou={() => setNComent((n) => n + 1)}
        destacarComentarioId={destacarComentarioId}
      />
      {shareModal}
    </article>
  )
}
