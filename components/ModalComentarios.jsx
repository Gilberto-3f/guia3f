'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Comentario from '@/components/Comentario'
import { pickAutorDisplay } from '@/lib/feed-autor'

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
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)

  const selectAutorEmbed = `usuarios!autor_id (
          id, email,
          turistas (nome_completo, nome_usuario, foto_perfil_url),
          profissionais (nome_completo, nome_usuario, foto_perfil_url),
          empresas (nome_fantasia, nome_usuario, foto_url)
        )`

  const selectAutorPlain = `usuarios (
          id, email,
          turistas (nome_completo, nome_usuario, foto_perfil_url),
          profissionais (nome_completo, nome_usuario, foto_perfil_url),
          empresas (nome_fantasia, nome_usuario, foto_url)
        )`

  const carregar = async () => {
    const base = () =>
      supabase
        .from('comentarios')
        .select(
          `
        id,
        texto,
        created_at,
        total_curtidas,
        ${selectAutorEmbed}
      `
        )
        .eq('post_id', postId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })

    let { data, error } = await base()

    if (error) {
      const retry = await supabase
        .from('comentarios')
        .select(
          `
        id,
        texto,
        created_at,
        total_curtidas,
        ${selectAutorPlain}
      `
        )
        .eq('post_id', postId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
      data = retry.data
      error = retry.error
    }

    if (error) {
      console.error('ModalComentarios carregar:', error)
      setLista([])
      return
    }

    const formatados =
      data?.map((row) => {
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
      }) ?? []

    setLista(formatados)
  }

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
  }, [aberto, postId])

  useEffect(() => {
    if (!aberto || !destacarComentarioId) return
    const t = window.setTimeout(() => {
      document.getElementById(`comentario-${destacarComentarioId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 200)
    return () => clearTimeout(t)
  }, [aberto, destacarComentarioId, lista])

  const enviar = async () => {
    if (!texto.trim() || !usuarioId) return
    setEnviando(true)
    try {
      const { error } = await supabase.from('comentarios').insert({
        post_id: postId,
        autor_id: usuarioId,
        texto: texto.trim(),
      })
      if (error) return
      setTexto('')
      await carregar()
      onComentou?.()
    } finally {
      setEnviando(false)
    }
  }

  if (!aberto) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div
        className="flex w-full max-w-lg flex-col rounded-t-2xl bg-white sm:max-h-[85vh] sm:rounded-2xl"
        style={{ height: 'min(66dvh, 85vh)' }}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
          <h3 className="font-semibold text-gray-800">Comentários</h3>
          <button type="button" onClick={onFechar} className="p-1" aria-label="Fechar">
            <X size={22} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
          {lista.length === 0 ? <p className="py-8 text-center text-sm text-gray-400">Nenhum comentário</p> : null}
          {lista.map((c) => (
            <Comentario
              key={c.id}
              comentario={c}
              usuarioId={usuarioId}
              destacado={Boolean(destacarComentarioId && c.id === destacarComentarioId)}
            />
          ))}
        </div>
        <div className="shrink-0 border-t border-gray-100 p-3">
          <div className="flex gap-2">
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escreva um comentário..."
              className="flex-1 rounded-full border border-gray-200 px-3 py-2 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && void enviar()}
            />
            <button
              type="button"
              disabled={!texto.trim() || enviando || !usuarioId}
              onClick={() => void enviar()}
              className="rounded-full bg-[#0097b2] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
