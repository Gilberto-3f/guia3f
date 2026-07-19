'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Bookmark, Heart, MessageCircle, Repeat2, Share2, ShieldCheck, ShoppingBag, Star } from 'lucide-react'
import ModalComentarios from '@/components/ModalComentarios'
import ModalCurtidas from '@/components/ModalCurtidas'
import ModalCompartilhar from '@/components/ModalCompartilhar'
import MenuPost from '@/components/MenuPost'
import DrawerProdutosCde from '@/components/DrawerProdutosCde'
import { formatarUsd, precoFinalUsd } from '@/lib/comprasCdeCatalogo'
import { supabase } from '@/lib/supabase'
import { isTipoVideoPost } from '@/lib/feedFiltroSeguidos'
import { STORY_RING_GRADIENT, emailVisualizouStory, pickAutorDisplay } from '@/lib/feed-autor'
import { formatarDataRelativaPublicacao } from '@/lib/formatarDataPublicacao'
import AvatarImage from '@/components/AvatarImage'
import MediaFillImage from '@/components/MediaFillImage'
import UsuarioHandleVerificado from '@/components/UsuarioHandleVerificado'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { useGateFeedSocial } from '@/lib/useGateFeedSocial'
import PopupAvisoBloqueioConta from '@/components/PopupAvisoBloqueioConta'
import { notificarEngajamentoAtividades } from '@/lib/atividades-events'
import { getPerfilHref } from '@/lib/perfil-utils'
import { asUuidFilter } from '@/lib/supabaseRestUuid'
import { useEmpresaInteratorSocial } from '@/lib/useEmpresaInteratorSocial'
import { usuarioCurtiuNoModoAtual } from '@/lib/curtidaModoSocial'
import { isDuplicateCurtidaError, toggleCurtidaSocial } from '@/lib/toggleCurtidaSocial'

/** UUID da empresa avaliada no `avaliacao_meta`, ou `null`. */
function postAvaliacaoEmpresaAlvoId(p) {
  const t = String(p?.tipo ?? '').toLowerCase()
  const meta = p?.avaliacao_meta
  if (t !== 'avaliacao' || !meta || typeof meta !== 'object' || Array.isArray(meta)) return null
  const eid = /** @type {Record<string, unknown>} */ (meta).empresa_id
  const s = eid != null ? String(eid).trim() : ''
  return s !== '' ? s : null
}

/**
 * Texto do post com “Ver mais” / “Ver menos” (mede overflow real, estilo Instagram).
 * @param {{ texto: string, postId: string, maxLines: 5 | 20, className?: string }} props
 */
function PostTextoColapsivel({ texto, postId, maxLines, className = '' }) {
  const pRef = useRef(/** @type {HTMLParagraphElement | null} */ (null))
  const [expanded, setExpanded] = useState(false)
  const [truncado, setTruncado] = useState(false)

  const clampClass = maxLines === 5 ? 'line-clamp-[5]' : 'line-clamp-[20]'

  useLayoutEffect(() => {
    setExpanded(false)
    setTruncado(false)
  }, [postId, texto])

  useLayoutEffect(() => {
    if (!texto) return
    const el = pRef.current
    if (!el || expanded) return

    const measure = () => {
      const e = pRef.current
      if (!e) return
      setTruncado(e.scrollHeight > e.clientHeight + 2)
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [texto, postId, expanded, clampClass])

  if (!texto) return null

  return (
    <div className={className}>
      <p
        ref={pRef}
        className={`text-sm text-gray-800 whitespace-pre-wrap ${expanded ? '' : clampClass}`}
      >
        {texto}
      </p>
      {truncado ? (
        <button
          type="button"
          className="mt-1 text-sm font-medium text-[#0097b2] hover:underline"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? 'Ver menos' : 'Ver mais'}
        </button>
      ) : null}
    </div>
  )
}

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
 *   storyAtivo?: { id: string, visualizado_por: unknown, conteudo_url?: string | null } | null
 *   onAbrirStory?: (storyId: string) => void
 *   onRemove?: (postId: string) => void
 *   abrirComentariosInicial?: boolean
 *   destacarComentarioId?: string | null
 *   comentariosInline?: boolean
 *   compositorComentarioAteClique?: boolean
 *   comentariosSomenteLeitura?: boolean
 *   onRepublicouPrepend?: (row: Record<string, unknown>) => void
 *   onPostLocalPatch?: (postId: string, patch: Partial<{ texto: string | null }>) => void
 *   onItemSalvoChange?: (postId: string, salvo: boolean) => void
 *   onRepostRemovido?: (repostPostId: string) => void
 *   onEngagementChange?: (postId: string, patch: { total_curtidas?: number; total_comentarios?: number }) => void
 *   ocultarCabecalhoCard?: boolean
 *   suprimirNotificacaoAtividades?: boolean
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
  comentariosInline = false,
  compositorComentarioAteClique = false,
  comentariosSomenteLeitura = false,
  onRepublicouPrepend,
  onPostLocalPatch,
  onItemSalvoChange,
  onRepostRemovido,
  onEngagementChange,
  ocultarCabecalhoCard = false,
  suprimirNotificacaoAtividades = false,
}) {
  if (!post || !post.id || !post.autor) {
    console.warn('[PostCard] post inválido:', post)
    return null
  }

  const { podeInteragir, notificarSomenteLeitura } = useModoApresentacao()
  const bloqueioApresentacao = !podeInteragir
  const { perfilEhEmpresa } = useProfissionalGate()
  const {
    podeInteragirFeedSocial,
    avisarBloqueioFeed,
    avisoFeedAberto,
    fecharAvisoBloqueioFeed,
    mensagemBloqueioFeed,
    tituloBloqueioFeed,
  } = useGateFeedSocial()
  const bloqueioFeedSocial = !podeInteragirFeedSocial
  /** Empresa não salva publicações do feed. */
  const ocultarSalvarPost = Boolean(perfilEhEmpresa)
  const empresaInteratorId = useEmpresaInteratorSocial()
  const [comentAberto, setComentAberto] = useState(false)
  const [curtidasAberto, setCurtidasAberto] = useState(false)
  const [shareAberto, setShareAberto] = useState(false)
  const [nComent, setNComent] = useState(post.total_comentarios ?? 0)
  const [repostTotal, setRepostTotal] = useState(post.total_reposts ?? 0)
  const [curtTotal, setCurtTotal] = useState(post.total_curtidas ?? 0)
  const [curtiu, setCurtiu] = useState(false)
  const curtirBusyRef = useRef(false)
  const [salvo, setSalvo] = useState(false)
  const [jaSegueEmpresa, setJaSegueEmpresa] = useState(false)
  const [jaSegueUsuario, setJaSegueUsuario] = useState(false)
  const [tickSeguir, setTickSeguir] = useState(0)
  const [autorOriginalUsername, setAutorOriginalUsername] = useState(/** @type {string | null} */ (null))
  const [autorOriginalUsuarioId, setAutorOriginalUsuarioId] = useState(/** @type {string | null} */ (null))
  const [autorOriginalEmpresaId, setAutorOriginalEmpresaId] = useState(/** @type {string | null} */ (null))
  const [autorOriginalRole, setAutorOriginalRole] = useState(/** @type {string | null} */ (null))
  const [meuRepostPostId, setMeuRepostPostId] = useState(/** @type {string | null} */ (null))
  const [editando, setEditando] = useState(false)
  const [textoEditado, setTextoEditado] = useState('')
  /** Proporção largura/altura da mídia ( pixels do ficheiro = recorte exportado em criar ). */
  const [mediaAspectRatio, setMediaAspectRatio] = useState(/** @type {number | null} */ (null))
  const [compositorAberto, setCompositorAberto] = useState(false)
  const [drawerCatalogoAberto, setDrawerCatalogoAberto] = useState(false)

  const empresaId = post.autor?.empresa_id || ''
  const autorId = post.autor?.usuario_id || ''
  const autorRoleNorm = String(post.autor?.role ?? '').toLowerCase()
  const hrefAutor = autorId
    ? getPerfilHref({ usuario_id: autorId, role: post.autor?.role, empresa_id: post.autor?.empresa_id || null })
    : ''
  const hrefAutorOriginal = autorOriginalUsuarioId
    ? getPerfilHref({
        usuario_id: autorOriginalUsuarioId,
        role: autorOriginalRole ?? undefined,
        empresa_id: autorOriginalEmpresaId,
      })
    : ''

  const mostrarSeguirUsuario = Boolean(
    !empresaId && autorRoleNorm !== 'empresa' && meuUsuarioId && autorId && autorId !== meuUsuarioId
  )

  const seguidoTipo = post.autor?.role || 'turista'

  const usuarioAlvo = useMemo(() => {
    if (!mostrarSeguirUsuario) return null
    return { seguidoId: autorId, seguidoTipo, jaSegue: jaSegueUsuario }
  }, [mostrarSeguirUsuario, autorId, seguidoTipo, jaSegueUsuario])

  /** `empresa_id` do alvo quando o post é avaliação compartilhada (para foto/nome atualizados). */
  const avaliacaoAlvoEmpresaId = useMemo(
    () => postAvaliacaoEmpresaAlvoId(post),
    [post?.tipo, post?.id, post?.avaliacao_meta]
  )

  const [avaliacaoAlvoEmpresaLive, setAvaliacaoAlvoEmpresaLive] = useState(
    /** @type {{ foto_url?: string | null, nome_fantasia?: string | null, nome_usuario?: string | null } | null} */ (null)
  )

  /** Com `empresa_id`, só mostramos o bloco da empresa depois do fetch — evita flash do `avaliacao_meta` antigo. */
  const [avaliacaoEmpresaDadosProntos, setAvaliacaoEmpresaDadosProntos] = useState(
    () => !postAvaliacaoEmpresaAlvoId(post)
  )

  /** Nota/feedback ao vivo (evita divergência do post compartilhado após editar avaliação). */
  const [avaliacaoAlvoLive, setAvaliacaoAlvoLive] = useState(
    /** @type {{ nota?: number | null, feedback?: string | null } | null} */ (null)
  )
  const [avaliacaoConteudoDadosProntos, setAvaliacaoConteudoDadosProntos] = useState(
    () => !postAvaliacaoEmpresaAlvoId(post)
  )

  useLayoutEffect(() => {
    if (!avaliacaoAlvoEmpresaId) {
      setAvaliacaoEmpresaDadosProntos(true)
      setAvaliacaoAlvoEmpresaLive(null)
      setAvaliacaoConteudoDadosProntos(true)
      setAvaliacaoAlvoLive(null)
      return
    }
    setAvaliacaoEmpresaDadosProntos(false)
    setAvaliacaoAlvoEmpresaLive(null)
    setAvaliacaoConteudoDadosProntos(false)
    setAvaliacaoAlvoLive(null)
  }, [avaliacaoAlvoEmpresaId, post.id])

  useEffect(() => {
    if (!avaliacaoAlvoEmpresaId) return
    let cancelled = false
    void supabase
      .from('empresas')
      .select('foto_url, nome_fantasia, nome_usuario')
      .eq('id', avaliacaoAlvoEmpresaId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        setAvaliacaoAlvoEmpresaLive(error || !data ? null : data)
        setAvaliacaoEmpresaDadosProntos(true)
      })
    return () => {
      cancelled = true
    }
  }, [avaliacaoAlvoEmpresaId, post.id])

  useEffect(() => {
    if (!avaliacaoAlvoEmpresaId) return
    const autorUsuarioId = post?.autor?.usuario_id
    if (!autorUsuarioId) {
      setAvaliacaoAlvoLive(null)
      setAvaliacaoConteudoDadosProntos(true)
      return
    }
    let cancelled = false
    const uid = String(autorUsuarioId)
    const alvoId = String(avaliacaoAlvoEmpresaId)

    const fetchPorAlvo = () =>
      supabase
        .from('avaliacoes')
        .select('nota, feedback')
        .eq('usuario_id', uid)
        .eq('alvo_id', alvoId)
        .eq('alvo_tipo', 'empresa')
        .maybeSingle()

    const fetchPorEmpresaId = () =>
      supabase
        .from('avaliacoes')
        .select('nota, feedback')
        .eq('usuario_id', uid)
        .eq('empresa_id', alvoId)
        .eq('alvo_tipo', 'empresa')
        .maybeSingle()

    void fetchPorAlvo()
      .then(({ data, error }) => {
        if (cancelled) return { data: null, error: error ?? null }
        if (!error && data) {
          setAvaliacaoAlvoLive(data)
          setAvaliacaoConteudoDadosProntos(true)
          return { data, error: null }
        }
        return fetchPorEmpresaId()
      })
      .then(({ data, error }) => {
        if (cancelled) return
        setAvaliacaoAlvoLive(error || !data ? null : data)
        setAvaliacaoConteudoDadosProntos(true)
      })
    return () => {
      cancelled = true
    }
  }, [avaliacaoAlvoEmpresaId, post.id, post?.autor?.usuario_id])

  useEffect(() => {
    setNComent(post.total_comentarios ?? 0)
  }, [post.total_comentarios, post.id])

  useEffect(() => {
    if (!compositorComentarioAteClique || !comentariosInline) return
    setCompositorAberto(false)
  }, [post.id, compositorComentarioAteClique, comentariosInline])

  useEffect(() => {
    if (comentariosInline) return
    if (abrirComentariosInicial) {
      setComentAberto(true)
    }
  }, [comentariosInline, abrirComentariosInicial, destacarComentarioId, post.id])

  useEffect(() => {
    setRepostTotal(post.total_reposts ?? 0)
  }, [post.total_reposts, post.id])

  useEffect(() => {
    setCurtTotal(post.total_curtidas ?? 0)
  }, [post.total_curtidas, post.id])

  useEffect(() => {
    const pid = asUuidFilter(post.id)
    const uid = asUuidFilter(meuUsuarioId)
    if (!uid || !pid) {
      setCurtiu(false)
      return
    }
    void usuarioCurtiuNoModoAtual(supabase, {
      postId: pid,
      usuarioId: uid,
      empresaInteratorId,
    }).then(setCurtiu)
  }, [post.id, meuUsuarioId, empresaInteratorId])

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
      .eq('alvo_id', empresaId)
      .eq('alvo_tipo', 'empresa')
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
  /** Republicação: UI não depende do fetch do autor original (evita cabeçalho “só @eu” antes de carregar). */
  const ehRepost = Boolean(postOriginalId)

  useEffect(() => {
    if (!postOriginalId) {
      setAutorOriginalUsername(null)
      setAutorOriginalUsuarioId(null)
      setAutorOriginalEmpresaId(null)
      setAutorOriginalRole(null)
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
        setAutorOriginalUsuarioId(a.usuario_id ? String(a.usuario_id) : null)
        setAutorOriginalEmpresaId(a.empresa_id ? String(a.empresa_id) : null)
        setAutorOriginalRole(a.role ? String(a.role) : null)
      })
    return () => {
      cancel = true
    }
  }, [postOriginalId])

  useEffect(() => {
    if (!meuUsuarioId || !post.id) {
      setMeuRepostPostId(null)
      return
    }
    void supabase
      .from('posts')
      .select('id')
      .eq('post_original_id', post.id)
      .eq('autor_id', meuUsuarioId)
      .is('deleted_at', null)
      .maybeSingle()
      .then(({ data }) => setMeuRepostPostId(data?.id != null ? String(data.id) : null))
  }, [post.id, meuUsuarioId])

  const mediaUrl = post.conteudo_url || post.foto_url
  const hasMedia = Boolean(mediaUrl)
  const tipoNorm = String(post.tipo || '').toLowerCase()
  const ehAvaliacao = tipoNorm === 'avaliacao'
  const isVideoPost = isTipoVideoPost(post.tipo)

  useEffect(() => {
    setMediaAspectRatio(null)
  }, [mediaUrl])

  const temStoryNoAutor = Boolean(storyAtivo?.id)
  const storyDoAutorVisto = temStoryNoAutor ? emailVisualizouStory(storyAtivo?.visualizado_por, userEmail) : true

  const resumo = (post.texto || 'Publicação').slice(0, 80)
  const postUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/feed?post=${encodeURIComponent(post.id)}` : ''

  const handleEditarPost = () => {
    if (bloqueioApresentacao) {
      notificarSomenteLeitura()
      return
    }
    if (bloqueioFeedSocial) {
      avisarBloqueioFeed()
      return
    }
    if (!meuUsuarioId) return
    // Repost: só o autor do post original pode editar o texto.
    if (postOriginalId) return
    setTextoEditado(post.texto ?? '')
    setEditando(true)
  }

  const salvarEdicao = async () => {
    if (bloqueioApresentacao) {
      notificarSomenteLeitura()
      return
    }
    if (bloqueioFeedSocial) {
      avisarBloqueioFeed()
      return
    }
    if (!meuUsuarioId || postOriginalId) return
    const texto = textoEditado.trim() ? textoEditado.trim() : null
    const { error } = await supabase.from('posts').update({ texto }).eq('id', post.id).eq('autor_id', meuUsuarioId)
    if (error) {
      alert('Não foi possível salvar.')
      return
    }
    onPostLocalPatch?.(post.id, { texto })
    setEditando(false)
  }

  const modalEditar =
    editando && meuUsuarioId ? (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) setEditando(false)
        }}
        role="presentation"
      >
        <div
          className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl bg-white shadow-xl"
          role="dialog"
          aria-labelledby="editar-post-titulo"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-gray-100 px-4 py-3">
            <h3 id="editar-post-titulo" className="text-lg font-bold text-gray-900">
              Editar post
            </h3>
            <p className="mt-1 text-xs text-gray-500">Ajuste o texto da publicação abaixo.</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <textarea
              className="min-h-[180px] w-full resize-y rounded-lg border border-gray-200 p-3 text-sm text-gray-900"
              rows={8}
              value={textoEditado}
              onChange={(e) => setTextoEditado(e.target.value)}
              placeholder="Escreva aqui…"
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-100 p-4">
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void salvarEdicao()}
              className="rounded-lg bg-[#0097b2] px-4 py-2 text-sm font-medium text-white hover:opacity-95"
            >
              Salvar
            </button>
          </div>
        </div>
      </div>
    ) : null

  const shareModal = (
    <ModalCompartilhar
      aberto={shareAberto}
      onFechar={() => setShareAberto(false)}
      postUrl={postUrl}
      tituloResumo={resumo}
      imagemUrl={post.foto_url || post.conteudo_url || null}
    />
  )

  const handleCurtir = async () => {
    if (bloqueioApresentacao) {
      notificarSomenteLeitura()
      return
    }
    if (curtirBusyRef.current) return
    const pid = asUuidFilter(post.id)
    const uid = asUuidFilter(meuUsuarioId)
    if (!pid || !uid) return

    const eraCurtido = curtiu
    const totalAntes = curtTotal
    curtirBusyRef.current = true

    if (eraCurtido) {
      setCurtiu(false)
      setCurtTotal((t) => {
        const n = Math.max(0, t - 1)
        onEngagementChange?.(post.id, { total_curtidas: n })
        return n
      })
    } else {
      setCurtiu(true)
      setCurtTotal((t) => {
        const n = t + 1
        onEngagementChange?.(post.id, { total_curtidas: n })
        return n
      })
    }

    try {
      const { data, error } = await toggleCurtidaSocial(supabase, {
        postId: pid,
        empresaInteratorId,
      })

      if (error && !isDuplicateCurtidaError(error)) {
        console.error('[PostCard] curtir:', error)
        setCurtiu(eraCurtido)
        setCurtTotal(totalAntes)
        onEngagementChange?.(post.id, { total_curtidas: totalAntes })
        return
      }

      const liked = error && isDuplicateCurtidaError(error) ? true : Boolean(data?.liked)
      setCurtiu(liked)
      if (liked === eraCurtido) {
        setCurtTotal(totalAntes)
        onEngagementChange?.(post.id, { total_curtidas: totalAntes })
      }

      if (!suprimirNotificacaoAtividades) {
        if (liked && !eraCurtido) {
          notificarEngajamentoAtividades()
        } else if (!liked && eraCurtido) {
          notificarEngajamentoAtividades({
            sincronizarLista: true,
            remover: { autorId: uid, postId: pid },
          })
        }
      }
    } finally {
      curtirBusyRef.current = false
    }
  }

  const ultimoToqueFotoRef = useRef({ time: 0, x: 0, y: 0 })

  const handleCurtirFotoDoubleTap = useCallback(() => {
    if (isVideoPost || bloqueioApresentacao || !meuUsuarioId || curtiu) return
    void handleCurtir()
  }, [isVideoPost, bloqueioApresentacao, meuUsuarioId, curtiu, handleCurtir])

  const onFotoPointerUp = useCallback(
    (e) => {
      if (isVideoPost || e.pointerType === 'mouse') return
      const now = Date.now()
      const x = e.clientX
      const y = e.clientY
      const { time, x: px, y: py } = ultimoToqueFotoRef.current
      if (now - time < 350 && Math.hypot(x - px, y - py) < 30) {
        ultimoToqueFotoRef.current = { time: 0, x: 0, y: 0 }
        handleCurtirFotoDoubleTap()
        return
      }
      ultimoToqueFotoRef.current = { time: now, x, y }
    },
    [isVideoPost, handleCurtirFotoDoubleTap],
  )

  const mostrarCompositorInline = !compositorComentarioAteClique || compositorAberto

  const handleComentar = () => {
    if (bloqueioApresentacao) {
      notificarSomenteLeitura()
      return
    }
    if (bloqueioFeedSocial) {
      avisarBloqueioFeed()
      return
    }
    if (comentariosInline && compositorComentarioAteClique) {
      setCompositorAberto(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.getElementById(`comentarios-inline-${post.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
      })
      return
    }
    if (comentariosInline) {
      document.getElementById(`comentarios-inline-${post.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    setComentAberto(true)
  }

  const abrirModalCompartilhar = () => {
    if (bloqueioFeedSocial) {
      avisarBloqueioFeed()
      return
    }
    setShareAberto(true)
  }

  const handleRepostar = async () => {
    if (bloqueioApresentacao) {
      notificarSomenteLeitura()
      return
    }
    if (bloqueioFeedSocial) {
      avisarBloqueioFeed()
      return
    }
    if (!meuUsuarioId) return

    if (meuRepostPostId) {
      const rid = meuRepostPostId
      const { error: delErr } = await supabase.from('posts').delete().eq('id', rid).eq('autor_id', meuUsuarioId)
      if (delErr) {
        console.error(delErr)
        alert('Não foi possível remover o repost.')
        return
      }
      const { error: rpcErr } = await supabase.rpc('decrementar_reposts', { post_id: post.id })
      if (rpcErr) console.error(rpcErr)
      setMeuRepostPostId(null)
      setRepostTotal((n) => Math.max(0, n - 1))
      onRepostRemovido?.(rid)
      return
    }

    const { data: postOriginal, error: e1 } = await supabase
      .from('posts')
      .select('*')
      .eq('id', post.id)
      .is('deleted_at', null)
      .maybeSingle()
    if (e1 || !postOriginal) {
      console.error('[repost] leitura do post original falhou', {
        postId: post.id,
        message: e1?.message,
        code: e1?.code,
        details: e1?.details,
        hint: e1?.hint,
        e1,
      })
      alert('Não foi possível repostar.')
      return
    }
    const o = /** @type {Record<string, unknown>} */ (postOriginal)
    const { data: ins, error: e2 } = await supabase
      .from('posts')
      .insert({
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
      console.error('[repost] insert do republicação falhou', {
        postId: post.id,
        post_original_id: post.id,
        message: e2?.message,
        code: e2?.code,
        details: e2?.details,
        hint: e2?.hint,
        e2,
      })
      alert('Não foi possível repostar.')
      return
    }
    const novoId = String(ins.id)
    setMeuRepostPostId(novoId)
    const { error: rpcErr } = await supabase.rpc('incrementar_reposts', { post_id: post.id })
    if (rpcErr) console.error(rpcErr)
    setRepostTotal((n) => n + 1)
    const { data: viewRow, error: e3 } = await supabase.from('posts_com_autores').select('*').eq('id', novoId).maybeSingle()
    if (e3) console.error('posts_com_autores após repost:', e3)
    if (!e3 && viewRow) onRepublicouPrepend?.(/** @type {Record<string, unknown>} */ (viewRow))
  }

  const handleSalvar = async () => {
    if (bloqueioApresentacao) {
      notificarSomenteLeitura()
      return
    }
    if (bloqueioFeedSocial) {
      avisarBloqueioFeed()
      return
    }
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
    postParentId: post.post_original_id ?? null,
    autorUsuarioId: post.autor?.usuario_id,
    meuUsuarioId,
    empresaAlvo: empresaId ? { empresaId, jaSegue: jaSegueEmpresa } : null,
    usuarioAlvo,
    salvo,
    // FIX: Menu precisa saber o tipo para esconder "Editar" em avaliações.
    postTipo: post?.tipo ?? null,
    onApagou: () => onRemove?.(post.id),
    onSeguiuEmpresa: () => setTickSeguir((t) => t + 1),
    onSeguiuUsuario: () => setTickSeguir((t) => t + 1),
    onEditar: handleEditarPost,
    onSalvar: ocultarSalvarPost ? undefined : () => void handleSalvar(),
    onRepublicar: ehAvaliacao ? undefined : () => void handleRepostar(),
    bloqueado: bloqueioApresentacao || bloqueioFeedSocial,
  }

  const repostEhFoto = tipoNorm === 'foto' || tipoNorm === 'misto'
  const isSelfRepost =
    ehRepost &&
    Boolean(autorId && autorOriginalUsuarioId && String(autorId) === String(autorOriginalUsuarioId))

  /** Cabeçalho compacto: quem republicou + autor original + data na mesma linha. */
  const cabecalhoRepublicou = ehRepost ? (
    <div className="border-b border-gray-50 px-4 pt-4 pb-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          {autorId ? (
            <Link
              href={hrefAutor}
              className="relative mt-0.5 h-8 w-8 shrink-0 overflow-hidden rounded-md bg-gray-100"
              aria-label={`Perfil de @${post.autor?.username ?? 'usuario'}`}
            >
              <AvatarImage
                src={post.autor?.foto_perfil_url}
                alt=""
                width={32}
                height={32}
                className="h-full w-full object-cover"
              />
            </Link>
          ) : (
            <div className="relative mt-0.5 h-8 w-8 shrink-0 overflow-hidden rounded-md bg-gray-100">
              <AvatarImage
                src={post.autor?.foto_perfil_url}
                alt=""
                width={32}
                height={32}
                className="h-full w-full object-cover"
              />
            </div>
          )}
          <div className="min-w-0 flex-1 text-xs leading-snug text-gray-600">
            {autorId ? (
              <Link href={hrefAutor} className="font-semibold text-gray-800 hover:text-[#0097b2]">
                <UsuarioHandleVerificado
                  username={post.autor?.username ?? ''}
                  verificado={Boolean(post.autor?.verificado)}
                  verificadoTipo={post.autor?.role === 'empresa' ? 'empresa' : 'profissional'}
                  asButton={false}
                  className="font-semibold text-gray-800 hover:text-[#0097b2]"
                />
              </Link>
            ) : (
              <span className="font-semibold text-gray-800">
                <UsuarioHandleVerificado
                  username={post.autor?.username ?? ''}
                  verificado={Boolean(post.autor?.verificado)}
                  verificadoTipo={post.autor?.role === 'empresa' ? 'empresa' : 'profissional'}
                  asButton={false}
                  className="font-semibold text-gray-800"
                />
              </span>
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
            <span className="text-gray-400">{' · '}</span>
            <span suppressHydrationWarning className="text-gray-400">
              {formatarDataRelativaPublicacao(post.created_at)}
            </span>
          </div>
        </div>
        <MenuPost {...menuProps} />
      </div>
    </div>
  ) : null

  const acoesPost = (
    <div className="flex w-full items-center justify-around px-2 py-2">
      <div className="flex items-center gap-0.5 text-sm text-gray-800">
        <button
          type="button"
          onClick={() => void handleCurtir()}
          disabled={!meuUsuarioId || bloqueioApresentacao}
          className="flex items-center p-1 disabled:opacity-50"
          aria-label="Curtir"
        >
          <Heart className={`h-5 w-5 shrink-0 ${curtiu ? 'fill-red-500 text-red-500' : 'text-gray-500'}`} aria-hidden />
        </button>
        <button type="button" onClick={() => setCurtidasAberto(true)} className="min-w-[1.25rem] py-1 text-left">
          {curtTotal}
        </button>
      </div>
      <button
        type="button"
        onClick={handleComentar}
        disabled={bloqueioApresentacao}
        className="flex items-center gap-1 text-sm text-gray-800 disabled:opacity-50"
      >
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
      {!ehAvaliacao ? (
        <button
          type="button"
          onClick={() => void handleRepostar()}
          disabled={!meuUsuarioId || bloqueioApresentacao}
          className="flex items-center gap-1 text-sm text-gray-800 disabled:opacity-50"
        >
          <Repeat2
            className={`h-5 w-5 shrink-0 ${meuRepostPostId ? 'text-[#0097b2]' : 'text-gray-500'}`}
            aria-hidden
          />
          <span>{repostTotal}</span>
        </button>
      ) : null}
      {!ocultarSalvarPost ? (
        <button
          type="button"
          onClick={() => void handleSalvar()}
          disabled={!meuUsuarioId || bloqueioApresentacao}
          className="flex items-center gap-1 text-gray-600 disabled:opacity-50"
          aria-label="Salvar"
        >
          <Bookmark className={`h-5 w-5 ${salvo ? 'fill-[#0097b2] text-[#0097b2]' : 'text-gray-500'}`} aria-hidden />
        </button>
      ) : null}
    </div>
  )

  const cabecalhoAutorFeed = !ocultarCabecalhoCard ? (
    ehRepost ? (
      cabecalhoRepublicou
    ) : (
      <div className="flex items-center justify-between p-4 pb-2">
        <div className="flex items-start gap-3">
          {temStoryNoAutor ? (
            <div
              className={`relative shrink-0 rounded-md p-[2px] ${storyDoAutorVisto ? 'bg-gray-300' : ''}`}
              style={!storyDoAutorVisto ? { background: STORY_RING_GRADIENT } : undefined}
            >
              <div className="rounded-md bg-white p-[2px]">
                <button
                  type="button"
                  onClick={() => storyAtivo?.id && onAbrirStory?.(storyAtivo.id)}
                  className="relative block h-10 w-10 shrink-0 overflow-hidden rounded-md bg-gray-100"
                  aria-label={`Ver story de ${post.autor?.nome ?? 'autor'}`}
                >
                  <AvatarImage
                    src={post.autor?.foto_perfil_url}
                    alt=""
                    width={40}
                    height={40}
                    className="h-full w-full object-cover"
                  />
                </button>
              </div>
            </div>
          ) : autorId ? (
            <Link
              href={hrefAutor}
              className="relative block h-10 w-10 shrink-0 overflow-hidden rounded-md bg-gray-100"
              aria-label={`Perfil de @${post.autor?.username ?? 'usuario'}`}
            >
              <AvatarImage src={post.autor?.foto_perfil_url} alt="" width={40} height={40} className="object-cover" />
            </Link>
          ) : (
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-gray-100">
              <AvatarImage
                src={post.autor?.foto_perfil_url}
                alt=""
                width={40}
                height={40}
                className="object-cover"
              />
            </div>
          )}
          <div>
            {autorId ? (
              <Link href={hrefAutor} className="text-sm font-semibold text-gray-800 hover:text-[#0097b2]">
                <UsuarioHandleVerificado
                  username={post.autor?.username ?? ''}
                  verificado={Boolean(post.autor?.verificado)}
                  verificadoTipo={post.autor?.role === 'empresa' ? 'empresa' : 'profissional'}
                  asButton={false}
                  className="font-semibold text-gray-800 hover:text-[#0097b2]"
                />
              </Link>
            ) : (
              <p className="text-sm font-semibold text-gray-800">
                <UsuarioHandleVerificado
                  username={post.autor?.username ?? ''}
                  verificado={Boolean(post.autor?.verificado)}
                  verificadoTipo={post.autor?.role === 'empresa' ? 'empresa' : 'profissional'}
                  asButton={false}
                  className="font-semibold text-gray-800"
                />
              </p>
            )}
            <time suppressHydrationWarning className="mt-0.5 block text-xs text-gray-400">
              {formatarDataRelativaPublicacao(post.created_at)}
            </time>
          </div>
        </div>
        <MenuPost {...menuProps} />
      </div>
    )
  ) : null

  if (tipoNorm === 'catalogo_produtos') {
    const meta =
      post.avaliacao_meta && typeof post.avaliacao_meta === 'object' && !Array.isArray(post.avaliacao_meta)
        ? /** @type {Record<string, unknown>} */ (post.avaliacao_meta)
        : {}
    const empresaCatalogoId =
      meta.empresa_id != null && String(meta.empresa_id).trim() !== ''
        ? String(meta.empresa_id)
        : empresaId
    const produtosSnap = Array.isArray(meta.produtos) ? meta.produtos.slice(0, 3) : []
    const qtdMeta = Number(meta.quantidade) || produtosSnap.length || 0
    const textoCatalogo =
      qtdMeta === 1
        ? 'cadastramos 1 novo produto em nosso catálogo, venha conferir.'
        : `cadastramos ${qtdMeta > 0 ? qtdMeta : 'XX'} novos produtos em nosso catálogo, venha conferir.`

    return (
      <article id={`feed-post-${post.id}`} className="rounded-xl bg-white shadow-sm">
        {cabecalhoAutorFeed}
        <div className="px-4 pb-3 pt-1">
          <p className="text-[15px] leading-snug text-gray-900">{textoCatalogo}</p>
          {produtosSnap.length > 0 ? (
            <div className="mt-3 flex items-stretch gap-2 overflow-x-auto pb-1">
              {produtosSnap.map((raw) => {
                const snap =
                  raw && typeof raw === 'object' && !Array.isArray(raw)
                    ? /** @type {Record<string, unknown>} */ (raw)
                    : {}
                const nome = typeof snap.nome === 'string' ? snap.nome : 'Produto'
                const foto =
                  snap.foto_url != null && String(snap.foto_url).trim() !== ''
                    ? String(snap.foto_url)
                    : null
                const pct = Number(snap.percentual_desconto) || 0
                const preco = Number(snap.preco_usd) || 0
                const final = precoFinalUsd(preco, pct)
                const idSnap = snap.id != null ? String(snap.id) : nome
                return (
                  <div
                    key={idSnap}
                    className="w-[108px] shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-gray-50"
                  >
                    <div className="relative aspect-square bg-gray-200">
                      {foto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={foto} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="p-1.5">
                      <p className="line-clamp-2 text-[11px] font-semibold leading-tight text-gray-800">
                        {nome}
                      </p>
                      <p className="mt-0.5 text-[11px] font-bold text-[#0097b2]">
                        {formatarUsd(final)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}
          {empresaCatalogoId ? (
            <button
              type="button"
              onClick={() => setDrawerCatalogoAberto(true)}
              className="mt-3 flex w-full min-h-[3.25rem] flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-center text-white transition-opacity hover:opacity-95"
              style={{ backgroundColor: '#0097b2' }}
              aria-label="Abrir catálogo"
            >
              <ShoppingBag className="h-5 w-5 shrink-0" aria-hidden />
              <span className="text-[11px] font-bold uppercase leading-tight tracking-wide">CATÁLOGO</span>
            </button>
          ) : null}
        </div>
        <div className="border-t border-gray-100">{acoesPost}</div>
        <ModalComentarios
          postId={post.id}
          variant={comentariosInline ? 'inline' : 'modal'}
          aberto={comentariosInline ? true : comentAberto}
          onFechar={() => setComentAberto(false)}
          usuarioId={meuUsuarioId}
          onComentou={() =>
            setNComent((n) => {
              const v = n + 1
              onEngagementChange?.(post.id, { total_comentarios: v })
              return v
            })
          }
          onTotalComentariosSync={(total) => {
            setNComent(total)
            onEngagementChange?.(post.id, { total_comentarios: total })
          }}
          destacarComentarioId={destacarComentarioId}
          totalComentariosVisual={nComent}
          somenteLeitura={comentariosSomenteLeitura || bloqueioApresentacao || bloqueioFeedSocial}
          mostrarCompositor={mostrarCompositorInline}
        />
        <ModalCurtidas
          postId={post.id}
          aberto={curtidasAberto}
          onFechar={() => setCurtidasAberto(false)}
          meuUsuarioId={meuUsuarioId}
        />
        {shareModal}
        {modalEditar}
        {empresaCatalogoId ? (
          <DrawerProdutosCde
            isOpen={drawerCatalogoAberto}
            onClose={() => setDrawerCatalogoAberto(false)}
            empresaId={empresaCatalogoId}
            empresaNome={post.autor?.nome ?? post.autor?.username ?? 'Empresa'}
            empresaUsername={post.autor?.username ?? null}
            empresaFotoUrl={post.autor?.foto_perfil_url ?? null}
          />
        ) : null}
      </article>
    )
  }

  if (tipoNorm === 'verificacao_profissional') {
    const meta =
      post.avaliacao_meta && typeof post.avaliacao_meta === 'object' && !Array.isArray(post.avaliacao_meta)
        ? /** @type {Record<string, unknown>} */ (post.avaliacao_meta)
        : {}
    const catRotulo = typeof meta.categoria_rotulo === 'string' ? meta.categoria_rotulo : '—'
    return (
      <article id={`feed-post-${post.id}`} className="rounded-xl bg-white shadow-sm">
        {!ocultarCabecalhoCard ? (
          ehRepost ? (
            cabecalhoRepublicou
          ) : (
            <div className="flex items-center justify-between border-b border-gray-50 px-4 pt-3">
              <div>
                {autorId ? (
                  <Link href={hrefAutor} className="text-sm font-semibold text-gray-800 hover:text-[#0097b2]">
                    <UsuarioHandleVerificado
                      username={post.autor?.username ?? ''}
                      verificado={Boolean(post.autor?.verificado)}
                  verificadoTipo={post.autor?.role === 'empresa' ? 'empresa' : 'profissional'}
                      asButton={false}
                      className="text-sm font-semibold text-gray-800 hover:text-[#0097b2]"
                    />
                  </Link>
                ) : (
                  <p className="text-sm font-semibold text-gray-800">
                    <UsuarioHandleVerificado
                      username={post.autor?.username ?? ''}
                      verificado={Boolean(post.autor?.verificado)}
                  verificadoTipo={post.autor?.role === 'empresa' ? 'empresa' : 'profissional'}
                      asButton={false}
                      className="text-sm font-semibold text-gray-800"
                    />
                  </p>
                )}
                <time suppressHydrationWarning className="text-xs text-gray-400">
                  {formatarDataRelativaPublicacao(post.created_at)}
                </time>
              </div>
              <MenuPost {...menuProps} />
            </div>
          )
        ) : null}
        <div className="px-4 pb-3 pt-3">
          <p className="mb-2 inline-block rounded-full bg-[#0097b2]/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#0097b2]">
            Novo profissional
          </p>
          <p className="text-[15px] leading-snug text-gray-900">{post.texto}</p>
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50/80 px-3 py-2.5">
            <ShieldCheck className="h-6 w-6 shrink-0 text-[#00D443]" aria-hidden />
            <span className="text-base font-bold text-[#0097b2]">{catRotulo}</span>
          </div>
        </div>
        <div className="border-t border-gray-100">{acoesPost}</div>
        <ModalComentarios
          postId={post.id}
          variant={comentariosInline ? 'inline' : 'modal'}
          aberto={comentariosInline ? true : comentAberto}
          onFechar={() => setComentAberto(false)}
          usuarioId={meuUsuarioId}
          onComentou={() =>
            setNComent((n) => {
              const v = n + 1
              onEngagementChange?.(post.id, { total_comentarios: v })
              return v
            })
          }
          onTotalComentariosSync={(total) => {
            setNComent(total)
            onEngagementChange?.(post.id, { total_comentarios: total })
          }}
          destacarComentarioId={destacarComentarioId}
          totalComentariosVisual={nComent}
          somenteLeitura={comentariosSomenteLeitura || bloqueioApresentacao || bloqueioFeedSocial}
          mostrarCompositor={mostrarCompositorInline}
        />
        <ModalCurtidas
          postId={post.id}
          aberto={curtidasAberto}
          onFechar={() => setCurtidasAberto(false)}
          meuUsuarioId={meuUsuarioId}
        />
        {shareModal}
        {modalEditar}
      </article>
    )
  }

  if (tipoNorm === 'avaliacao' && post.avaliacao_meta && typeof post.avaliacao_meta === 'object') {
    const meta = /** @type {{ empresa_id?: string, nome_fantasia?: string, nome_usuario?: string | null, foto_url?: string | null, nota?: number, feedback?: string | null, comentario?: string | null }} */ (
      post.avaliacao_meta
    )
    const empresaAlvoId = meta.empresa_id != null && String(meta.empresa_id) !== '' ? String(meta.empresa_id) : null
    const live = avaliacaoAlvoEmpresaLive
    const nomeFantasiaAlvoMeta =
      meta.nome_fantasia != null && String(meta.nome_fantasia).trim() !== '' ? String(meta.nome_fantasia).trim() : 'Estabelecimento'
    const nomeUsuarioAlvoMeta =
      meta.nome_usuario != null && String(meta.nome_usuario).trim() !== ''
        ? String(meta.nome_usuario).trim().replace(/^@+/, '')
        : ''
    const fotoAlvoMeta = meta.foto_url != null && String(meta.foto_url).trim() !== '' ? String(meta.foto_url) : null

    const aguardandoEmpresaAoVivo =
      Boolean(empresaAlvoId) && (!avaliacaoEmpresaDadosProntos || !avaliacaoConteudoDadosProntos)

    const notaNumMeta = Math.min(5, Math.max(0, Number(meta.nota) || 0))
    const notaNumLive =
      avaliacaoAlvoLive?.nota != null ? Math.min(5, Math.max(0, Number(avaliacaoAlvoLive.nota) || 0)) : null
    const notaNum = notaNumLive != null ? notaNumLive : notaNumMeta
    const notaVal = Math.min(5, Math.max(0, Math.round(notaNum)))
    const notaTexto = notaNum > 0 ? (Number.isInteger(notaNum) ? String(notaNum) : notaNum.toFixed(1)) : null

    const feedbackTextMeta =
      meta.feedback != null && String(meta.feedback).trim() !== ''
        ? String(meta.feedback)
        : meta.comentario != null && String(meta.comentario).trim() !== ''
          ? String(meta.comentario)
          : ''
    const feedbackTextLive =
      avaliacaoAlvoLive?.feedback != null && String(avaliacaoAlvoLive.feedback).trim() !== ''
        ? String(avaliacaoAlvoLive.feedback)
        : ''
    const feedbackText = feedbackTextLive !== '' ? feedbackTextLive : feedbackTextMeta

    const nomeFantasiaAlvo =
      !aguardandoEmpresaAoVivo &&
      live?.nome_fantasia != null &&
      String(live.nome_fantasia).trim() !== ''
        ? String(live.nome_fantasia).trim()
        : nomeFantasiaAlvoMeta
    const nomeUsuarioAlvoLive =
      live?.nome_usuario != null && String(live.nome_usuario).trim() !== ''
        ? String(live.nome_usuario).trim().replace(/^@+/, '')
        : ''
    const nomeUsuarioAlvo = nomeUsuarioAlvoLive !== '' ? nomeUsuarioAlvoLive : nomeUsuarioAlvoMeta

    const fotoAlvoLive = live?.foto_url != null && String(live.foto_url).trim() !== '' ? String(live.foto_url) : null
    const fotoAlvo = fotoAlvoLive ?? fotoAlvoMeta

    return (
      <article id={`feed-post-${post.id}`} className="rounded-xl bg-white shadow-sm">
        {cabecalhoAutorFeed}
        <div className="px-4 pb-3 pt-0">
          <p className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-gray-500">avaliação</p>
          <div className="mb-3 flex justify-center">
            <div
              className="flex w-full max-w-sm items-center gap-3 rounded-lg bg-gray-50 p-3"
              aria-busy={aguardandoEmpresaAoVivo}
            >
              {aguardandoEmpresaAoVivo ? (
                <>
                  <div
                    className="h-10 w-10 shrink-0 animate-pulse rounded-md bg-gray-200"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1 space-y-2 py-0.5">
                    <div className="h-4 max-w-[12rem] animate-pulse rounded bg-gray-200" aria-hidden />
                    <div className="h-3 max-w-[8rem] animate-pulse rounded bg-gray-200" aria-hidden />
                  </div>
                </>
              ) : (
                <>
                  {fotoAlvo ? (
                    empresaAlvoId ? (
                      <Link
                        href={`/empresa/${empresaAlvoId}`}
                        className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-gray-100"
                        aria-label={`Ver empresa ${nomeFantasiaAlvo}`}
                      >
                        <AvatarImage src={fotoAlvo} alt="" width={40} height={40} className="h-full w-full object-cover" />
                      </Link>
                    ) : (
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-gray-100">
                        <AvatarImage src={fotoAlvo} alt="" width={40} height={40} className="h-full w-full object-cover" />
                      </div>
                    )
                  ) : (
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gray-200 text-xs font-medium text-gray-500"
                      aria-hidden
                    >
                      …
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    {empresaAlvoId ? (
                      <Link
                        href={`/empresa/${empresaAlvoId}`}
                        className="block truncate font-semibold text-gray-900 hover:underline"
                      >
                        {nomeFantasiaAlvo}
                      </Link>
                    ) : (
                      <div className="truncate font-semibold text-gray-900">{nomeFantasiaAlvo}</div>
                    )}
                    {nomeUsuarioAlvo ? (
                      empresaAlvoId ? (
                        <Link
                          href={`/empresa/${empresaAlvoId}`}
                          className="mt-0.5 block truncate text-sm text-gray-500 hover:text-[#0097b2] hover:underline"
                        >
                          @{nomeUsuarioAlvo}
                        </Link>
                      ) : (
                        <span className="mt-0.5 block truncate text-sm text-gray-500">@{nomeUsuarioAlvo}</span>
                      )
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="mb-3 flex items-center justify-center gap-2" aria-label={`Nota ${notaVal} de 5`}>
            <div className="flex flex-wrap items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`h-6 w-6 shrink-0 ${s <= notaVal ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
                  aria-hidden
                />
              ))}
            </div>
            {notaTexto ? <span className="text-sm font-semibold text-gray-800">{notaTexto}</span> : null}
          </div>
          {feedbackText ? (
            <p className="whitespace-pre-wrap text-center text-sm leading-relaxed text-gray-800">{feedbackText}</p>
          ) : null}
        </div>
        <div className="border-t border-gray-100">{acoesPost}</div>
        <ModalComentarios
          postId={post.id}
          variant={comentariosInline ? 'inline' : 'modal'}
          aberto={comentariosInline ? true : comentAberto}
          onFechar={() => setComentAberto(false)}
          usuarioId={meuUsuarioId}
          onComentou={() =>
            setNComent((n) => {
              const v = n + 1
              onEngagementChange?.(post.id, { total_comentarios: v })
              return v
            })
          }
          onTotalComentariosSync={(total) => {
            setNComent(total)
            onEngagementChange?.(post.id, { total_comentarios: total })
          }}
          destacarComentarioId={destacarComentarioId}
          totalComentariosVisual={nComent}
          somenteLeitura={comentariosSomenteLeitura || bloqueioApresentacao || bloqueioFeedSocial}
          mostrarCompositor={mostrarCompositorInline}
        />
        <ModalCurtidas
          postId={post.id}
          aberto={curtidasAberto}
          onFechar={() => setCurtidasAberto(false)}
          meuUsuarioId={meuUsuarioId}
        />
        {shareModal}
        {modalEditar}
      </article>
    )
  }

  return (
    <article
      id={`feed-post-${post.id}`}
      className={comentariosInline ? 'rounded-xl bg-white shadow-sm' : 'rounded-xl bg-white shadow-sm'}
    >
      {cabecalhoAutorFeed}

      {hasMedia ? (
        <>
          <div
            className="relative w-full overflow-hidden bg-gray-100"
            style={{
              aspectRatio:
                mediaAspectRatio != null && mediaAspectRatio > 0
                  ? String(mediaAspectRatio)
                  : isVideoPost
                    ? '16 / 9'
                    : '4 / 5',
            }}
            onDoubleClick={
              !isVideoPost
                ? (e) => {
                    e.preventDefault()
                    handleCurtirFotoDoubleTap()
                  }
                : undefined
            }
            onPointerUp={!isVideoPost ? onFotoPointerUp : undefined}
          >
            {isVideoPost ? (
              <video
                src={mediaUrl}
                className="absolute inset-0 h-full w-full object-contain"
                controls
                playsInline
                preload="metadata"
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget
                  const w = v.videoWidth
                  const h = v.videoHeight
                  if (w > 0 && h > 0) setMediaAspectRatio(w / h)
                }}
              />
            ) : (
              <MediaFillImage
                src={mediaUrl}
                alt=""
                objectFit="contain"
                sizes="(max-width: 768px) 100vw, 480px"
                onLoad={(e) => {
                  const img = e.currentTarget
                  const w = img.naturalWidth
                  const h = img.naturalHeight
                  if (w > 0 && h > 0) setMediaAspectRatio(w / h)
                }}
              />
            )}
          </div>
          {acoesPost}
          {post.texto ? (
            <PostTextoColapsivel
              texto={post.texto}
              postId={post.id}
              maxLines={5}
              className="px-4 pb-3 pt-1"
            />
          ) : null}
        </>
      ) : (
        <>
          {post.texto ? (
            <PostTextoColapsivel
              texto={post.texto}
              postId={post.id}
              maxLines={20}
              className="px-4 py-2 pt-0"
            />
          ) : null}
          {acoesPost}
        </>
      )}

      <ModalComentarios
        postId={post.id}
        variant={comentariosInline ? 'inline' : 'modal'}
        aberto={comentariosInline ? true : comentAberto}
        onFechar={() => setComentAberto(false)}
        usuarioId={meuUsuarioId}
        onComentou={() =>
          setNComent((n) => {
            const v = n + 1
            onEngagementChange?.(post.id, { total_comentarios: v })
            return v
          })
        }
        onTotalComentariosSync={(total) => {
          setNComent(total)
          onEngagementChange?.(post.id, { total_comentarios: total })
        }}
        destacarComentarioId={destacarComentarioId}
        totalComentariosVisual={nComent}
        somenteLeitura={comentariosSomenteLeitura || bloqueioApresentacao || bloqueioFeedSocial}
        mostrarCompositor={mostrarCompositorInline}
      />
      <ModalCurtidas
        postId={post.id}
        aberto={curtidasAberto}
        onFechar={() => setCurtidasAberto(false)}
        meuUsuarioId={meuUsuarioId}
      />
      {shareModal}
      {modalEditar}
      <PopupAvisoBloqueioConta
        aberto={avisoFeedAberto}
        onFechar={fecharAvisoBloqueioFeed}
        titulo={tituloBloqueioFeed}
        mensagem={mensagemBloqueioFeed}
      />
    </article>
  )
}
