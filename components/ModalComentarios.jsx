'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Comentario from '@/components/Comentario'
import { fetchFotoPerfilUsuario } from '@/lib/feed-autor'
import { buscarPerfisPorIds } from '@/lib/perfil-utils'
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
 *   destacarComentarioId?: string | null
 * }} props
 */
export default function ModalComentarios({ postId, aberto, onFechar, usuarioId, onComentou, destacarComentarioId = null }) {
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

    const flat = rows.map((r) => {
      const rr = /** @type {Record<string, unknown>} */ (r)
      const aid = rr.autor_id != null ? String(rr.autor_id) : ''
      const p = aid ? perfilPorUsuario.get(aid) : undefined
      const fallback = { nome: 'Usuário', username: 'usuario', foto_perfil_url: null, usuario_id: aid }
      const autor = p
        ? {
            nome: String(p.nome ?? 'Usuário'),
            username: String(p.username ?? 'usuario'),
            foto_perfil_url: p.foto_url != null ? String(p.foto_url) : null,
            usuario_id: aid,
          }
        : fallback
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
      const el = listaScrollRef.current
      if (el) el.scrollTop = el.scrollHeight
    })
  }, [])

  const handleEnviarResposta = useCallback(
    async (parentId, texto) => {
      if (!usuarioId || !postId) return
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
    [postId, usuarioId, carregar, scrollListaAoFim, onComentou]
  )

  useEffect(() => {
    if (!aberto || !postId) return
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
  }, [aberto, postId, carregar])

  useEffect(() => {
    if (!aberto || !usuarioId) {
      setMinhaFotoUrl(null)
      return
    }
    void fetchFotoPerfilUsuario(supabase, usuarioId).then(setMinhaFotoUrl)
  }, [aberto, usuarioId])

  useEffect(() => {
    if (!aberto) {
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
  }, [aberto])

  /** Impede scroll do feed atrás do overlay (mobile e desktop). */
  useEffect(() => {
    if (!aberto || typeof document === 'undefined') return
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
  }, [aberto])

  useEffect(() => {
    if (!aberto || !destacarComentarioId) return
    const t = window.setTimeout(() => {
      document.getElementById(`comentario-${destacarComentarioId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 300)
    return () => clearTimeout(t)
  }, [aberto, destacarComentarioId, arvore])

  const handleEnviarComentario = async () => {
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

  if (!aberto) return null

  return (
    <div className="fixed inset-0 z-[230] flex items-end justify-center overscroll-none bg-black/50 sm:items-center sm:p-4">
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white text-black shadow-xl sm:max-h-[85vh] sm:rounded-2xl"
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
        <div
          ref={listaScrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 text-black"
        >
          {arvore.length === 0 ? <p className="py-8 text-center text-sm text-gray-900">Nenhum comentário</p> : null}
          {arvore.map((c) => (
            <Comentario
              key={c.id}
              node={c}
              usuarioId={usuarioId}
              destacarComentarioId={destacarComentarioId}
              onEnviarResposta={handleEnviarResposta}
              nivel={0}
              enviando={enviando}
            />
          ))}
        </div>
        <div
          className="shrink-0 border-t border-gray-200 bg-white p-3"
          style={{ paddingBottom: Math.max(12, tecladoInset) }}
        >
          <div className="flex items-end gap-2">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-gray-100">
              {minhaFotoUrl ? (
                <AvatarImage src={minhaFotoUrl} alt="" width={40} height={40} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">?</div>
              )}
            </div>
            <textarea
              ref={textareaRef}
              rows={2}
              className="max-h-28 min-h-[40px] flex-1 resize-y rounded-xl border border-gray-200 px-3 py-2 text-sm text-black placeholder:text-gray-400"
              placeholder="Escreva um comentário…"
              value={novoComentario}
              disabled={!usuarioId || enviando}
              onChange={(e) => setNovoComentario(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void handleEnviarComentario()
                }
              }}
            />
            <button
              type="button"
              disabled={!novoComentario.trim() || enviando || !usuarioId}
              onClick={() => void handleEnviarComentario()}
              className="shrink-0 rounded-xl bg-[#0097b2] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {enviando ? '…' : 'Enviar'}
            </button>
          </div>
          {!usuarioId ? <p className="mt-2 text-center text-xs text-gray-500">Entre na conta para comentar.</p> : null}
          <p className="mt-1 text-center text-[11px] text-gray-400">Enter envia · Shift+Enter nova linha</p>
        </div>
      </div>
    </div>
  )
}
