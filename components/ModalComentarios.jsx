'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Comentario from '@/components/Comentario'
import { fetchFotoPerfilUsuario } from '@/lib/feed-autor'
import AvatarImage from '@/components/AvatarImage'

const AUTOR_COLS = `id,
  email,
  role,
  turistas (nome_completo, nome_usuario, foto_perfil_url),
  profissionais (nome_completo, nome_usuario, foto_perfil_url),
  empresas (id, nome_fantasia, nome_usuario, foto_url)`

const COMENTARIOS_SELECT_VARIANTS = [
  `id, texto, created_at, total_curtidas, autor_id, autor:usuarios!comentarios_autor_id_fkey (${AUTOR_COLS})`,
  `id, texto, created_at, total_curtidas, autor_id, autor:usuarios!autor_id (${AUTOR_COLS})`,
  `id, texto, created_at, total_curtidas, autor_id, usuarios (${AUTOR_COLS})`,
]

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
  const [lista, setLista] = useState([])
  const [novoComentario, setNovoComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [minhaFotoUrl, setMinhaFotoUrl] = useState(/** @type {string | null} */ (null))
  const [tecladoInset, setTecladoInset] = useState(0)
  const textareaRef = useRef(/** @type {HTMLTextAreaElement | null} */ (null))
  const listaScrollRef = useRef(/** @type {HTMLDivElement | null} */ (null))

  const carregar = useCallback(async () => {
    const { pickAutorDisplay } = await import('@/lib/feed-autor')

    const USUARIOS_SELECT = `
      id, email, role,
      turistas (nome_completo, nome_usuario, foto_perfil_url),
      profissionais (nome_completo, nome_usuario, foto_perfil_url),
      empresas (id, nome_fantasia, nome_usuario, foto_url)
    `

    let data = /** @type {Record<string, unknown>[] | null} */ (null)
    for (const sel of COMENTARIOS_SELECT_VARIANTS) {
      const res = await supabase
        .from('comentarios')
        .select(sel)
        .eq('post_id', postId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      if (!res.error && res.data) {
        data = /** @type {Record<string, unknown>[]} */ (res.data)
        break
      }
      if (res.error) console.warn('ModalComentarios select:', res.error.message)
    }

    if (!data) {
      setLista([])
      return
    }

    const faltando = new Set()
    for (const r of data) {
      const rr = /** @type {Record<string, unknown>} */ (r)
      const emb = rr.autor ?? rr.usuarios
      const u = Array.isArray(emb) ? emb[0] : emb
      if (!u || typeof u !== 'object') {
        const aid = rr.autor_id != null ? String(rr.autor_id) : ''
        if (aid) faltando.add(aid)
      }
    }

    /** @type {Map<string, ReturnType<typeof pickAutorDisplay>>} */
    const extra = new Map()
    if (faltando.size > 0) {
      const { data: users, error: eu } = await supabase.from('usuarios').select(USUARIOS_SELECT).in('id', [...faltando])
      if (eu) console.error('ModalComentarios usuarios:', eu)
      for (const u of users ?? []) {
        const row = /** @type {{ id?: unknown }} */ (u)
        const id = row.id != null ? String(row.id) : ''
        if (id) extra.set(id, pickAutorDisplay(u))
      }
    }

    setLista(
      data.map((r) => {
        const rr = /** @type {Record<string, unknown>} */ (r)
        const emb = rr.autor ?? rr.usuarios
        const raw = Array.isArray(emb) ? emb[0] : emb
        const aid = rr.autor_id != null ? String(rr.autor_id) : ''
        const a =
          raw && typeof raw === 'object'
            ? pickAutorDisplay(raw)
            : aid
              ? (extra.get(aid) ?? { nome: 'Usuário', username: 'usuario', foto_perfil_url: null, usuario_id: '' })
              : { nome: 'Usuário', username: 'usuario', foto_perfil_url: null, usuario_id: '' }
        const autorUsuarioId = String((a && 'usuario_id' in a && a.usuario_id) || aid || '')
        return {
          id: String(rr.id),
          texto: String(rr.texto ?? ''),
          created_at: String(rr.created_at ?? ''),
          total_curtidas: Number(rr.total_curtidas) || 0,
          autor: { nome: a.nome, username: a.username, foto_perfil_url: a.foto_perfil_url, usuario_id: autorUsuarioId },
        }
      })
    )
  }, [postId])

  const scrollListaTopo = useCallback(() => {
    requestAnimationFrame(() => {
      const el = listaScrollRef.current
      if (el) el.scrollTop = 0
    })
  }, [])

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

  useEffect(() => {
    if (!aberto || !destacarComentarioId) return
    const t = window.setTimeout(() => {
      document.getElementById(`comentario-${destacarComentarioId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 300)
    return () => clearTimeout(t)
  }, [aberto, destacarComentarioId, lista])

  const handleResponder = useCallback((textoMencao) => {
    setNovoComentario(textoMencao)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }, [])

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
      if (error) return
      setNovoComentario('')
      await carregar()
      scrollListaTopo()
      onComentou?.()
      textareaRef.current?.blur()
    } finally {
      setEnviando(false)
    }
  }

  if (!aberto) return null

  return (
    <div className="fixed inset-0 z-[230] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
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
          {lista.length === 0 ? <p className="py-8 text-center text-sm text-gray-900">Nenhum comentário</p> : null}
          {lista.map((c) => (
            <Comentario
              key={c.id}
              comentario={c}
              usuarioId={usuarioId}
              destacado={Boolean(destacarComentarioId && c.id === destacarComentarioId)}
              onResponder={handleResponder}
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
              disabled={!usuarioId}
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
