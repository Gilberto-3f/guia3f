'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Comentario from '@/components/Comentario'
import { fetchFotoPerfilUsuario, pickAutorDisplay } from '@/lib/feed-autor'
import AvatarImage from '@/components/AvatarImage'

const SELECT_COMENTARIO_AUTOR = `
  id,
  texto,
  created_at,
  total_curtidas,
  autor_id,
  usuarios (
    id,
    email,
    role,
    turistas (nome_completo, nome_usuario, foto_perfil_url),
    profissionais (nome_completo, nome_usuario, foto_perfil_url),
    empresas (nome_fantasia, nome_usuario, foto_url)
  )
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
  const [tecladoAberto, setTecladoAberto] = useState(false)
  const textareaRef = useRef(/** @type {HTMLTextAreaElement | null} */ (null))
  const touchStartY = useRef(/** @type {number | null} */ (null))

  const formatarLinhas = useCallback((data) => {
    if (!data?.length) return []
    return data.map((row) => {
      const r = /** @type {Record<string, unknown>} */ (row)
      const rawU = r.usuarios
      const u = Array.isArray(rawU) ? rawU[0] : rawU
      const a = pickAutorDisplay(u)
      return {
        id: String(r.id),
        texto: String(r.texto ?? ''),
        created_at: String(r.created_at ?? ''),
        total_curtidas: Number(r.total_curtidas) || 0,
        autor: { nome: a.nome, username: a.username, foto_perfil_url: a.foto_perfil_url },
      }
    })
  }, [])

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('comentarios')
      .select(SELECT_COMENTARIO_AUTOR)
      .eq('post_id', postId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('ModalComentarios carregar:', error)
      setLista([])
      return
    }

    setLista(formatarLinhas(data ?? []))
  }, [postId, formatarLinhas])

  useEffect(() => {
    if (!aberto || !postId) return
    void carregar()

    const ch = supabase
      .channel(`comentarios-${postId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comentarios', filter: `post_id=eq.${postId}` }, () => {
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
      setTecladoAberto(false)
      return
    }
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!vv) return

    const atualizar = () => {
      const ratio = vv.height / window.innerHeight
      setTecladoAberto(ratio < 0.72)
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
    }, 200)
    return () => clearTimeout(t)
  }, [aberto, destacarComentarioId, lista])

  const handleResponder = useCallback((textoMencao) => {
    setNovoComentario(textoMencao)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }, [])

  const recolherPainel = useCallback(() => {
    textareaRef.current?.blur()
    setTecladoAberto(false)
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
      setNovoComentario('')
      await carregar()
      onComentou?.()
    } finally {
      setEnviando(false)
    }
  }

  if (!aberto) return null

  const alturaPainel = tecladoAberto ? '100dvh' : 'min(66dvh, 85vh)'

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white text-black shadow-xl transition-[height] duration-200 ease-out sm:max-h-[85vh] sm:rounded-2xl"
        style={{ height: alturaPainel, maxHeight: '100dvh' }}
      >
        <div
          className="shrink-0 border-b border-gray-100 px-4 pt-2 pb-1"
          onTouchStart={(e) => {
            touchStartY.current = e.touches[0]?.clientY ?? null
          }}
          onTouchEnd={(e) => {
            const start = touchStartY.current
            touchStartY.current = null
            if (start == null) return
            const end = e.changedTouches[0]?.clientY
            if (end != null && end - start > 48) recolherPainel()
          }}
        >
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-gray-300 sm:hidden" aria-hidden />
          <div className="flex items-center justify-between py-2">
            <h3 className="font-bold text-black">Comentários</h3>
            <button type="button" onClick={onFechar} className="p-1 text-black" aria-label="Fechar">
              <X size={22} />
            </button>
          </div>
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

        <div className="shrink-0 border-t border-gray-200 bg-white p-3 [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))]">
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
              className="max-h-28 min-h-[40px] flex-1 resize-none rounded-lg border border-gray-200 p-2 text-sm text-black"
              rows={1}
              placeholder="Adicione um comentário..."
              value={novoComentario}
              onChange={(e) => setNovoComentario(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void enviarComentario()
                }
              }}
            />
            <button
              type="button"
              disabled={!novoComentario.trim() || enviando || !usuarioId}
              onClick={() => void enviarComentario()}
              className="shrink-0 px-2 py-2 text-sm font-bold text-[#0097b2] disabled:opacity-40"
            >
              Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
