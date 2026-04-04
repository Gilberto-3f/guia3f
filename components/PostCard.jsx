'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { Bookmark, Heart, MessageCircle, Repeat2, Share2 } from 'lucide-react'
import ModalComentarios from '@/components/ModalComentarios'
import ModalCompartilhar from '@/components/ModalCompartilhar'
import MenuPost from '@/components/MenuPost'
import AvaliacaoCard from '@/components/AvaliacaoCard'
import { supabase } from '@/lib/supabase'
import { STORY_RING_GRADIENT, emailVisualizouStory, pickAutorDisplay } from '@/lib/feed-autor'
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
 *     total_reposts?: number
 *     avaliacao_meta: Record<string, unknown> | null
 *     created_at: string
 *     post_original_id?: string | null
 *     autor: { nome: string, username: string, foto_perfil_url: string | null, usuario_id: string, empresa_id: string, role: string }
 *   }
 *   meuUsuarioId: string | null
 *   userEmail?: string | null
 *   storyAtivo?: { id: string, visualizado_por: unknown } | null
 *   onAbrirStory?: (storyId: string) => void
 *   onRemove?: (postId: string) => void
 *   abrirComentariosInicial?: boolean
 *   destacarComentarioId?: string | null
 *   onRepublicouPrepend?: (row: Record<string, unknown>) => void
 *   onPostLocalPatch?: (postId: string, patch: Partial<{ texto: string | null }>) => void
 *   onItemSalvoChange?: (postId: string, salvo: boolean) => void
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
  onRepublicouPrepend,
  onPostLocalPatch,
  onItemSalvoChange,
}) {
  const [comentAberto, setComentAberto] = useState(false)
  const deepLinkComentAberto = useRef(/** @type {string | null} */ (null))
  const [shareAberto, setShareAberto] = useState(false)
  const [nComent, setNComent] = useState(post.total_comentarios ?? 0)
  const [repostTotal, setRepostTotal] = useState(post.total_reposts ?? 0)
  const [curtTotal, setCurtTotal] = useState(post.total_curtidas ?? 0)
  const [curtiu, setCurtiu] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [jaSegueEmpresa, setJaSegueEmpresa] = useState(false)
  const [jaSegueUsuario, setJaSegueUsuario] = useState(false)
  const [tickSeguir, setTickSeguir] = useState(0)
  const [autorOriginalUsername, setAutorOriginalUsername] = useState(/** @type {string | null} */ (null))

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
    setRepostTotal(post.total_reposts ?? 0)
  }, [post.total_reposts, post.id])

  useEffect(() => {
    setCurtTotal(post.total_curtidas ?? 0)
  }, [post.total_curtidas, post.id])

  useEffect(() => {
    if (!meuUsuarioId || !post.id) {
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
  }, [post.id, meuUsuarioId])

  useEffect(() => {
    if (!meuUsuarioId || !post.id) {
      setSalvo(false)
      return
    }
    void supabase
      .from('item_salvo')
      .select('id')
      .eq('post_id', post.id)
      .eq('usuario_id', meuUsuarioId)
      .maybeSingle()
      .then(({ data }) => setSalvo(Boolean(data)))
  }, [post.id, meuUsuarioId])

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

  const postOriginalId = post.post_original_id != null && post.post_original_id !== '' ? String(post.post_original_id) : null

  useEffect(() => {
    if (!postOriginalId) {
      setAutorOriginalUsername(null)
      return
    }
    let cancel = false
    void supabase
      .from('posts_com_autores')
      .select('*')
      .eq('id', postOriginalId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancel || error || !data) return
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
      })
    return () => {
      cancel = true
    }
  }, [postOriginalId])

  const mediaUrl = post.conteudo_url || post.foto_url
  const hasMedia = Boolean(mediaUrl)
  const tipoNorm = String(post.tipo || '').toLowerCase()

  const temStoryNoAutor = Boolean(storyAtivo?.id)
  const storyDoAutorVisto = temStoryNoAutor ? emailVisualizouStory(storyAtivo?.visualizado_por, userEmail) : true

  const resumo = (post.texto || 'Publicação').slice(0, 80)
  const postUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/feed?post=${encodeURIComponent(post.id)}` : ''

  const handleEditarPost = () => {
    if (!meuUsuarioId) return
    const atual = post.texto ?? ''
    const novo = window.prompt('Editar texto da publicação:', atual)
    if (novo === null) return
    const texto = novo.trim() ? novo.trim() : null
    void (async () => {
      const { error } = await supabase.from('posts').update({ texto }).eq('id', post.id).eq('autor_id', meuUsuarioId)
      if (error) {
        alert('Não foi possível salvar.')
        return
      }
      onPostLocalPatch?.(post.id, { texto })
    })()
  }

  const shareModal = (
    <ModalCompartilhar aberto={shareAberto} onFechar={() => setShareAberto(false)} postUrl={postUrl} tituloResumo={resumo} />
  )

  const handleCurtir = async () => {
    if (!meuUsuarioId) return
    if (curtiu) {
      await supabase.from('curtidas').delete().eq('post_id', post.id).eq('usuario_id', meuUsuarioId)
      setCurtiu(false)
      setCurtTotal((t) => Math.max(0, t - 1))
    } else {
      const { error } = await supabase.from('curtidas').insert({ post_id: post.id, usuario_id: meuUsuarioId })
      if (error) return
      setCurtiu(true)
      setCurtTotal((t) => t + 1)
    }
  }

  const handleComentar = () => setComentAberto(true)

  const abrirModalCompartilhar = () => setShareAberto(true)

  const handleRepostar = async () => {
    if (!meuUsuarioId) return
    const { data: postOriginal, error: e1 } = await supabase
      .from('posts')
      .select('*')
      .eq('id', post.id)
      .is('deleted_at', null)
      .maybeSingle()
    if (e1 || !postOriginal) {
      console.error(e1)
      alert('Não foi possível republicar.')
      return
    }
    const o = /** @type {Record<string, unknown>} */ (postOriginal)
    const { data: ins, error: e2 } = await supabase.from('posts').insert({
      autor_id: meuUsuarioId,
      tipo: o.tipo != null ? String(o.tipo) : 'texto',
      texto: o.texto != null ? String(o.texto) : null,
      foto_url: o.foto_url != null ? String(o.foto_url) : null,
      conteudo_url: o.conteudo_url != null ? String(o.conteudo_url) : null,
      avaliacao_meta: o.avaliacao_meta && typeof o.avaliacao_meta === 'object' ? o.avaliacao_meta : null,
      post_original_id: post.id,
    })
      .select('id')
      .maybeSingle()
    if (e2 || !ins?.id) {
      console.error(e2)
      alert('Não foi possível republicar.')
      return
    }
    const { error: rpcErr } = await supabase.rpc('incrementar_reposts', { post_id: post.id })
    if (rpcErr) console.error(rpcErr)
    setRepostTotal((n) => n + 1)
    const { data: viewRow, error: e3 } = await supabase.from('posts_com_autores').select('*').eq('id', ins.id).maybeSingle()
    if (e3) console.error('posts_com_autores após repost:', e3)
    if (!e3 && viewRow) onRepublicouPrepend?.(/** @type {Record<string, unknown>} */ (viewRow))
  }

  const handleSalvar = async () => {
    if (!meuUsuarioId) return
    if (salvo) {
      await supabase.from('item_salvo').delete().eq('post_id', post.id).eq('usuario_id', meuUsuarioId)
      setSalvo(false)
      onItemSalvoChange?.(post.id, false)
    } else {
      const { error } = await supabase.from('item_salvo').insert({ post_id: post.id, usuario_id: meuUsuarioId })
      if (!error) {
        setSalvo(true)
        onItemSalvoChange?.(post.id, true)
      }
    }
  }

  const menuProps = {
    postId: post.id,
    autorUsuarioId: post.autor?.usuario_id,
    meuUsuarioId,
    empresaAlvo: empresaId ? { empresaId, jaSegue: jaSegueEmpresa } : null,
    usuarioAlvo,
    salvo,
    onApagou: () => onRemove?.(post.id),
    onSeguiuEmpresa: () => setTickSeguir((t) => t + 1),
    onSeguiuUsuario: () => setTickSeguir((t) => t + 1),
    onEditar: handleEditarPost,
    onSalvar: () => void handleSalvar(),
    onRepublicar: () => void handleRepostar(),
  }

  const repostEhFoto = tipoNorm === 'foto' || tipoNorm === 'misto'

  const linhaRepost =
    postOriginalId && autorOriginalUsername ? (
      <div className="mb-2 text-xs text-gray-500">
        <span className="font-semibold text-gray-700">@{post.autor?.username ?? ''}</span> repostou
        {repostEhFoto ? ' foto de ' : ' post de '}
        <span className="font-semibold text-gray-700">@{autorOriginalUsername}</span>
      </div>
    ) : null

  const acoesPost = (
    <div className="flex items-center justify-between px-3 py-2">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => void handleCurtir()}
          disabled={!meuUsuarioId}
          className="flex items-center gap-1 text-sm text-gray-800 disabled:opacity-50"
        >
          <Heart className={`h-5 w-5 shrink-0 ${curtiu ? 'fill-red-500 text-red-500' : 'text-gray-500'}`} aria-hidden />
          <span>{curtTotal}</span>
        </button>
        <button type="button" onClick={handleComentar} className="flex items-center gap-1 text-sm text-gray-800">
          <MessageCircle className="h-5 w-5 shrink-0 text-gray-500" aria-hidden />
          <span>{nComent}</span>
        </button>
        <button
          type="button"
          onClick={abrirModalCompartilhar}
          className="flex items-center gap-1 text-sm text-gray-800"
          aria-label="Compartilhar"
        >
          <Share2 className="h-5 w-5 shrink-0 text-gray-500" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => void handleRepostar()}
          disabled={!meuUsuarioId}
          className="flex items-center gap-1 text-sm text-gray-800 disabled:opacity-50"
        >
          <Repeat2 className="h-5 w-5 shrink-0 text-gray-500" aria-hidden />
          <span>{repostTotal}</span>
        </button>
      </div>
      <button
        type="button"
        onClick={() => void handleSalvar()}
        disabled={!meuUsuarioId}
        className="text-gray-600 disabled:opacity-50"
        aria-label="Salvar"
      >
        <Bookmark className={`h-5 w-5 ${salvo ? 'fill-[#0097b2] text-[#0097b2]' : 'text-gray-500'}`} aria-hidden />
      </button>
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
        {linhaRepost ? <div className="border-b border-gray-50 px-4 pt-3">{linhaRepost}</div> : null}
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
        <div className="border-t border-gray-100">{acoesPost}</div>
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
      {linhaRepost ? <div className="px-4 pt-4 pb-0">{linhaRepost}</div> : null}
      <div className="flex items-center justify-between p-4 pb-2">
        <div className="flex items-start gap-3">
          {temStoryNoAutor ? (
            <div
              className={`relative shrink-0 rounded-md p-[2px] ${storyDoAutorVisto ? 'bg-gray-300' : ''}`}
              style={!storyDoAutorVisto ? { background: STORY_RING_GRADIENT } : undefined}
            >
              <button
                type="button"
                className="relative block h-11 w-11 overflow-hidden rounded-md bg-gray-100 p-0"
                onClick={() => storyAtivo?.id && onAbrirStory?.(storyAtivo.id)}
                aria-label={`Story de ${post.autor?.nome ?? 'autor'}`}
              >
                <AvatarImage
                  src={post.autor?.foto_perfil_url}
                  alt=""
                  width={44}
                  height={44}
                  className="h-full w-full object-cover"
                />
              </button>
            </div>
          ) : (
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-gray-100">
              <AvatarImage
                src={post.autor?.foto_perfil_url}
                alt=""
                width={44}
                height={44}
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
          {post.texto ? (
            <p className="whitespace-pre-wrap px-4 py-2 pt-0 text-sm text-gray-800">{post.texto}</p>
          ) : null}
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
