'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Send, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Comentario from '@/components/Comentario'
import { fetchFotoPerfilUsuario, fetchFotosPerfilPorUsuarioIds } from '@/lib/feed-autor'
import { buscarPerfisPorIds } from '@/lib/perfil-utils'
import { fetchVerificadoPorUsuarioIds } from '@/lib/contaVerificada'
import AvatarImage from '@/components/AvatarImage'

/**
 * Monta árvore de comentários (vários níveis: resposta à resposta).
 * @param {Array<{ id: string, resposta_para_id: string | null, created_at: string, [key: string]: unknown }>} flat
 */
function buildCommentTree(flat) {
  const byId = new Map()
  for (const row of flat) {
    byId.set(row.id, { ...row, replies: [] })
  }
  const roots = []
  for (const row of flat) {
    const node = byId.get(row.id)
    if (!node) continue
    const pid = row.resposta_para_id != null && row.resposta_para_id !== '' ? String(row.resposta_para_id) : null
    if (!pid) {
      roots.push(node)
    } else {
      const parent = byId.get(pid)
      if (parent) {
        parent.replies.push(node)
      } else {
        roots.push(node)
      }
    }
  }
  const sortByDate = (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  roots.sort(sortByDate)
  function sortReplies(n) {
    n.replies.sort(sortByDate)
    for (const ch of n.replies) sortReplies(ch)
  }
  roots.forEach(sortReplies)
  return roots
}

/**
 * @param {{
 *   postId: string
 *   aberto: boolean
 *   onFechar: () => void
 *   usuarioId: string | null
 *   onComentou?: () => void
 *   onComentarioExcluido?: () => void
 *   onTotalComentariosSync?: (total: number) => void
 *   destacarComentarioId?: string | null
 *   variant?: 'modal' | 'inline'
 *   totalComentariosVisual?: number | null
 *   somenteLeitura?: boolean
 *   mostrarCompositor?: boolean
 * }} props
 */
export default function ModalComentarios({
  postId,
  aberto,
  onFechar,
  usuarioId,
  onComentou,
  onComentarioExcluido,
  onTotalComentariosSync,
  destacarComentarioId = null,
  variant = 'modal',
  totalComentariosVisual = null,
  somenteLeitura = false,
  mostrarCompositor = true,
}) {
  const inline = variant === 'inline'
  /** Em linha: sempre ativo com `postId`; em modal: só quando `aberto`. */
  const ativo = inline || aberto
  /** Sem envio de comentários (modo leitura ou post isolado). */
  const leituraComentarios = Boolean(somenteLeitura)
  const mostrarRodape = !leituraComentarios && (!inline || mostrarCompositor)
  const [arvore, setArvore] = useState([])
  const [novoComentario, setNovoComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [minhaFotoUrl, setMinhaFotoUrl] = useState(/** @type {string | null} */ (null))
  const [tecladoInset, setTecladoInset] = useState(0)
  const textareaRef = useRef(/** @type {HTMLTextAreaElement | null} */ (null))
  const listaScrollRef = useRef(/** @type {HTMLDivElement | null} */ (null))

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('comentarios')
      .select('id, texto, created_at, total_curtidas, autor_id, resposta_para_id')
      .eq('post_id', postId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('ModalComentarios comentarios:', error.message)
      setArvore([])
      return
    }

    const rows = /** @type {Record<string, unknown>[]} */ (data ?? [])
    const autorIds = [...new Set(rows.map((r) => (r.autor_id != null ? String(r.autor_id) : '')).filter(Boolean))]
    const perfis = await buscarPerfisPorIds(supabase, autorIds)
    const perfilPorUsuario = new Map(perfis.map((p) => [String(p.usuario_id), p]))
    const fotosPorUsuario = await fetchFotosPerfilPorUsuarioIds(supabase, autorIds)
    const verificadoPorUsuario = await fetchVerificadoPorUsuarioIds(supabase, autorIds)

    const flat = rows.map((r) => {
      const rr = /** @type {Record<string, unknown>} */ (r)
      const aid = rr.autor_id != null ? String(rr.autor_id) : ''
      const p = aid ? perfilPorUsuario.get(aid) : undefined
      const fallback = { nome: 'Usuário', username: 'usuario', foto_perfil_url: null, usuario_id: aid, tipo: null, empresa_id: null }
      const fotoAtual =
        aid && fotosPorUsuario.has(aid)
          ? fotosPorUsuario.get(aid) ?? null
          : p && p.foto_url != null
            ? String(p.foto_url)
            : null
      const verificado = Boolean(aid && verificadoPorUsuario.get(aid))
      const autor = p
        ? {
            nome: String(p.nome ?? 'Usuário'),
            username: String(p.username ?? 'usuario'),
            foto_perfil_url: fotoAtual,
            usuario_id: aid,
            tipo: p.tipo ?? null,
            empresa_id: p.empresa_id ?? null,
            verificado,
          }
        : aid && fotosPorUsuario.has(aid)
          ? {
              nome: 'Usuário',
              username: 'usuario',
              foto_perfil_url: fotoAtual,
              usuario_id: aid,
              tipo: null,
              empresa_id: null,
              verificado,
            }
          : { ...fallback, verificado }
      return {
        id: String(rr.id),
        texto: String(rr.texto ?? ''),
        created_at: String(rr.created_at ?? ''),
        total_curtidas: Number(rr.total_curtidas) || 0,
        resposta_para_id: rr.resposta_para_id != null && rr.resposta_para_id !== '' ? String(rr.resposta_para_id) : null,
        autor,
      }
    })

    setArvore(buildCommentTree(flat))
  }, [postId])

  /** Lista em ordem cronológica crescente: último comentário no fim. */
  const scrollListaAoFim = useCallback(() => {
    requestAnimationFrame(() => {
      if (inline) {
        if (leituraComentarios) {
          document.getElementById(`comentarios-inline-${postId}`)?.scrollIntoView({ behavior: 'smooth', block: 'end' })
        } else {
          document.getElementById(`comentarios-rodape-${postId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
        return
      }
      const el = listaScrollRef.current
      if (el) el.scrollTop = el.scrollHeight
    })
  }, [inline, leituraComentarios, postId])

  const handleExcluirComentario = useCallback(
    async (commentId) => {
      const { error } = await supabase.from('comentarios').delete().eq('id', commentId)
      if (error) {
        console.error('ModalComentarios delete:', error.message)
        return
      }
      await carregar()
      const { data: postRow } = await supabase.from('posts').select('total_comentarios').eq('id', postId).maybeSingle()
      const pr = /** @type {Record<string, unknown> | null} */ (postRow)
      const total =
        pr && typeof pr.total_comentarios === 'number'
          ? pr.total_comentarios
          : typeof pr?.total_comentarios === 'string'
            ? parseInt(String(pr.total_comentarios), 10)
            : NaN
      if (!Number.isNaN(total)) {
        onTotalComentariosSync?.(total)
      } else {
        onComentarioExcluido?.()
      }
    },
    [carregar, onComentarioExcluido, onTotalComentariosSync, postId]
  )

  const handleEnviarResposta = useCallback(
    async (parentId, texto) => {
      if (leituraComentarios || !usuarioId || !postId) return
      setEnviando(true)
      try {
        const { error } = await supabase.from('comentarios').insert({
          post_id: postId,
          autor_id: usuarioId,
          texto,
          resposta_para_id: parentId,
        })
        if (error) {
          console.error('ModalComentarios resposta:', error.message)
          return
        }
        await carregar()
        scrollListaAoFim()
        onComentou?.()
      } finally {
        setEnviando(false)
      }
    },
    [leituraComentarios, postId, usuarioId, carregar, scrollListaAoFim, onComentou]
  )

  useEffect(() => {
    if (!ativo || !postId) return
    void carregar()

    const ch = supabase
      .channel(`comentarios-${postId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comentarios', filter: `post_id=eq.${postId}` }, () => {
        void carregar()
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(ch)
    }
  }, [ativo, postId, carregar])

  useEffect(() => {
    if (!ativo || !usuarioId || leituraComentarios) {
      setMinhaFotoUrl(null)
      return
    }
    void fetchFotoPerfilUsuario(supabase, usuarioId).then(setMinhaFotoUrl)
  }, [ativo, usuarioId, leituraComentarios])

  useEffect(() => {
    if (!ativo || !postId) return
    const onPerfilAtualizado = () => {
      void carregar()
      if (usuarioId && !leituraComentarios) {
        void fetchFotoPerfilUsuario(supabase, usuarioId).then(setMinhaFotoUrl)
      }
    }
    window.addEventListener('perfil-atualizado', onPerfilAtualizado)
    return () => window.removeEventListener('perfil-atualizado', onPerfilAtualizado)
  }, [ativo, postId, carregar, usuarioId, leituraComentarios])

  useEffect(() => {
    if (!ativo || leituraComentarios) {
      setTecladoInset(0)
      return
    }
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!vv) return
    const atualizar = () => {
      const gap = window.innerHeight - vv.height - vv.offsetTop
      setTecladoInset(Math.max(0, Math.round(gap)))
    }
    atualizar()
    vv.addEventListener('resize', atualizar)
    vv.addEventListener('scroll', atualizar)
    return () => {
      vv.removeEventListener('resize', atualizar)
      vv.removeEventListener('scroll', atualizar)
    }
  }, [ativo, leituraComentarios])

  /** Impede scroll do feed atrás do overlay (apenas modal). */
  useEffect(() => {
    if (inline || !aberto || typeof document === 'undefined') return
    const html = document.documentElement
    const body = document.body
    const prevHtmlOverflow = html.style.overflow
    const prevBodyOverflow = body.style.overflow
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    return () => {
      html.style.overflow = prevHtmlOverflow
      body.style.overflow = prevBodyOverflow
    }
  }, [inline, aberto])

  useEffect(() => {
    if (!ativo || !destacarComentarioId) return
    const t = window.setTimeout(() => {
      document.getElementById(`comentario-${destacarComentarioId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 300)
    return () => clearTimeout(t)
  }, [ativo, destacarComentarioId, arvore])

  /** Altura do compositor: várias linhas até max-h-24; recalcula ao limpar o texto. */
  useEffect(() => {
    if (!ativo) return
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 36), 96)}px`
  }, [novoComentario, ativo])

  const handleEnviarComentario = async () => {
    if (leituraComentarios) return
    const texto = novoComentario.trim()
    if (!texto || !usuarioId) return
    setEnviando(true)
    try {
      const { error } = await supabase.from('comentarios').insert({
        post_id: postId,
        autor_id: usuarioId,
        texto,
      })
      if (error) {
        console.error('ModalComentarios insert:', error.message)
        return
      }
      setNovoComentario('')
      await carregar()
      scrollListaAoFim()
      onComentou?.()
      textareaRef.current?.blur()
    } finally {
      setEnviando(false)
    }
  }

  if (!ativo) return null

  const tituloSecao =
    totalComentariosVisual != null && !Number.isNaN(Number(totalComentariosVisual))
      ? `Comentários (${totalComentariosVisual})`
      : 'Comentários'

  const listaClasses = inline
    ? 'min-w-0 max-w-full overflow-x-hidden px-4 pb-2 text-black'
    : 'min-h-0 min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 text-black'

  const lista = (
    <div ref={listaScrollRef} className={listaClasses}>
      {arvore.length === 0 ? <p className="py-8 text-center text-sm text-gray-900">Nenhum comentário</p> : null}
      {arvore.map((c) => (
        <Comentario
          key={c.id}
          node={c}
          usuarioId={usuarioId}
          destacarComentarioId={destacarComentarioId}
          onEnviarResposta={leituraComentarios ? undefined : handleEnviarResposta}
          onExcluir={leituraComentarios ? undefined : handleExcluirComentario}
          nivel={0}
          enviando={enviando}
        />
      ))}
    </div>
  )

  const rodape = (
    <div
      id={`comentarios-rodape-${postId}`}
      className={`shrink-0 border-t border-gray-200 bg-white p-3 ${inline ? 'sticky bottom-0 z-[2] shadow-[0_-4px_12px_rgba(0,0,0,0.06)]' : ''}`}
      style={{ paddingBottom: Math.max(12, tecladoInset) }}
    >
      <div className="flex min-w-0 items-end gap-2">
        <div className="relative h-9 w-9 shrink-0 self-center overflow-hidden rounded-md bg-gray-100">
          {minhaFotoUrl ? (
            <AvatarImage src={minhaFotoUrl} alt="" width={36} height={36} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">?</div>
          )}
        </div>
        <textarea
          ref={textareaRef}
          rows={1}
          className="max-h-24 min-h-9 min-w-0 flex-1 resize-none rounded-2xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm leading-5 text-black placeholder:text-gray-400 focus:border-[#0097b2] focus:outline-none focus:ring-1 focus:ring-[#0097b2]"
          placeholder="Comentar"
          value={novoComentario}
          disabled={!usuarioId || enviando}
          onChange={(e) => setNovoComentario(e.target.value)}
        />
        <button
          type="button"
          disabled={!novoComentario.trim() || enviando || !usuarioId}
          onClick={() => void handleEnviarComentario()}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center self-end rounded-lg bg-[#0097b2] text-white shadow-sm transition hover:bg-[#0088a1] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none"
          aria-label="Enviar comentário"
        >
          {enviando ? (
            <span className="text-xs font-medium" aria-hidden>
              …
            </span>
          ) : (
            <Send className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>
      {!usuarioId ? <p className="mt-2 text-center text-xs text-gray-500">Entre na conta para comentar.</p> : null}
    </div>
  )

  if (inline) {
    return (
      <section
        id={`comentarios-inline-${postId}`}
        className="mt-0 min-w-0 max-w-full overflow-x-hidden border-t border-gray-100 bg-white text-black"
        aria-label="Comentários na publicação"
      >
        <div className="border-b border-gray-100 px-4 py-2.5">
          <h3 className="text-sm font-semibold text-gray-900">{tituloSecao}</h3>
        </div>
        {lista}
        {mostrarRodape ? rodape : null}
      </section>
    )
  }

  return (
    <div className="fixed inset-0 z-[230] flex items-end justify-center overscroll-none bg-black/50 sm:items-center sm:p-4">
      <div
        className="flex w-full min-w-0 max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white text-black shadow-xl sm:max-h-[85vh] sm:rounded-2xl"
        style={{ height: 'min(70vh, 85vh)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-comentarios-titulo"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
          <h3 id="modal-comentarios-titulo" className="font-bold text-black">
            Comentários
          </h3>
          <button type="button" onClick={onFechar} className="p-1 text-black" aria-label="Fechar">
            <X size={22} />
          </button>
        </div>
        {lista}
        {mostrarRodape ? rodape : null}
      </div>
    </div>
  )
}
