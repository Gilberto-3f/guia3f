'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Comentario from '@/components/Comentario'
import { fetchFotoPerfilUsuario } from '@/lib/feed-autor'
import AvatarImage from '@/components/AvatarImage'

const USUARIOS_SELECT = `
  id,
  email,
  role,
  turistas (nome_completo, nome_usuario, foto_perfil_url),
  profissionais (nome_completo, nome_usuario, foto_perfil_url),
  empresas (nome_fantasia, nome_usuario, foto_url)
`

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
  const [composeAberto, setComposeAberto] = useState(false)
  const [tecladoInset, setTecladoInset] = useState(0)
  const textareaRef = useRef(/** @type {HTMLTextAreaElement | null} */ (null))

  const formatarComAutores = useCallback(async (rows) => {
    if (!rows?.length) return []
    const ids = [...new Set(rows.map((r) => String(r.autor_id)))]
    const { data: users, error } = await supabase.from('usuarios').select(USUARIOS_SELECT).in('id', ids)
    if (error) {
      console.error('ModalComentarios usuarios:', error)
    }
    const { pickAutorDisplay } = await import('@/lib/feed-autor')
    const map = new Map()
    for (const u of users ?? []) {
      const row = /** @type {{ id?: unknown }} */ (u)
      const id = row.id != null ? String(row.id) : ''
      if (id) map.set(id, pickAutorDisplay(u))
    }
    return rows.map((r) => {
      const rr = /** @type {Record<string, unknown>} */ (r)
      const aid = String(rr.autor_id ?? '')
      const a = map.get(aid) ?? { nome: 'Usuário', username: 'usuario', foto_perfil_url: null }
      return {
        id: String(rr.id),
        texto: String(rr.texto ?? ''),
        created_at: String(rr.created_at ?? ''),
        total_curtidas: Number(rr.total_curtidas) || 0,
        autor: { nome: a.nome, username: a.username, foto_perfil_url: a.foto_perfil_url },
      }
    })
  }, [])

  const carregar = useCallback(async () => {
    const { data: rows, error } = await supabase
      .from('comentarios')
      .select('id, texto, created_at, total_curtidas, autor_id')
      .eq('post_id', postId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('ModalComentarios comentarios:', error)
      setLista([])
      return
    }

    const formatados = await formatarComAutores(rows ?? [])
    setLista(formatados)
  }, [postId, formatarComAutores])

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
    if (!aberto || !composeAberto) {
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
  }, [aberto, composeAberto])

  useEffect(() => {
    if (!aberto) setComposeAberto(false)
  }, [aberto])

  useEffect(() => {
    if (!aberto || !destacarComentarioId) return
    const t = window.setTimeout(() => {
      document.getElementById(`comentario-${destacarComentarioId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 200)
    return () => clearTimeout(t)
  }, [aberto, destacarComentarioId, lista])

  const abrirCompose = useCallback((textoInicial = '') => {
    setNovoComentario(textoInicial)
    setComposeAberto(true)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }, [])

  const handleResponder = useCallback(
    (textoMencao) => {
      abrirCompose(textoMencao)
    },
    [abrirCompose]
  )

  const fecharCompose = useCallback(() => {
    setComposeAberto(false)
    setNovoComentario('')
    setTecladoInset(0)
  }, [])

  const enviarComentario = async () => {
    if (!novoComentario.trim() || !usuarioId) return
    setEnviando(true)
    try {
      const { error } = await supabase.from('comentarios').insert({
        post_id: postId,
        autor_id: usuarioId,
        texto: novoComentario.trim(),
      })
      if (error) return
      fecharCompose()
      await carregar()
      onComentou?.()
    } finally {
      setEnviando(false)
    }
  }

  if (!aberto) return null

  return (
    <>
      {!composeAberto ? (
        <div className="fixed inset-0 z-[230] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
          <div
            className="flex w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white text-black shadow-xl sm:max-h-[85vh] sm:rounded-2xl"
            style={{ height: 'min(70vh, 85vh)' }}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
              <h3 className="font-bold text-black">Comentários</h3>
              <button type="button" onClick={onFechar} className="p-1 text-black" aria-label="Fechar">
                <X size={22} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 text-black">
              {lista.length === 0 ? <p className="py-8 text-center text-sm text-gray-900">Nenhum comentário</p> : null}
              {lista.map((c, index) => (
                <Comentario
                  key={c.id}
                  comentario={c}
                  usuarioId={usuarioId}
                  destacado={Boolean(destacarComentarioId && c.id === destacarComentarioId)}
                  mostrarResponder={index > 0}
                  onResponder={handleResponder}
                />
              ))}
            </div>
            <div className="shrink-0 border-t border-gray-200 bg-white p-3">
              <button
                type="button"
                onClick={() => abrirCompose('')}
                disabled={!usuarioId}
                className="w-full rounded-xl border border-[#0097b2] py-3 text-center text-sm font-semibold text-[#0097b2] disabled:opacity-50"
              >
                Adicionar comentário
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {composeAberto ? (
        <div
          className="fixed inset-0 z-[235] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) fecharCompose()
          }}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl"
            style={{ marginBottom: tecladoInset }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="modal-comentario-titulo"
          >
            <div className="mb-3 flex items-center justify-between">
              <h4 id="modal-comentario-titulo" className="text-base font-bold text-gray-900">
                {novoComentario.trim().startsWith('@') ? 'Responder' : 'Novo comentário'}
              </h4>
              <button type="button" onClick={fecharCompose} className="p-1 text-gray-600" aria-label="Fechar">
                <X size={20} />
              </button>
            </div>
            <div className="flex items-end gap-2">
              <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md bg-gray-100">
                {minhaFotoUrl ? (
                  <AvatarImage src={minhaFotoUrl} alt="" width={32} height={32} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">?</div>
                )}
              </div>
              <textarea
                ref={textareaRef}
                className="max-h-40 min-h-[100px] flex-1 resize-y rounded-lg border border-gray-200 p-2 text-sm text-black"
                placeholder="Adicione um comentário..."
                value={novoComentario}
                onChange={(e) => setNovoComentario(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault()
                    void enviarComentario()
                  }
                }}
              />
            </div>
            <p className="mt-1 text-xs text-gray-400">Enter nova linha · Ctrl+Enter envia</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={fecharCompose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!novoComentario.trim() || enviando || !usuarioId}
                onClick={() => void enviarComentario()}
                className="rounded-lg bg-[#0097b2] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
