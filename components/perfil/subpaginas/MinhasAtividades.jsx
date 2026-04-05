'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

/**
 * @param {{ usuarioId: string }} props
 */
export default function MinhasAtividades({ usuarioId }) {
  const [aba, setAba] = useState(/** @type {'curtidas' | 'comentarios'} */ ('curtidas'))
  const [curtidas, setCurtidas] = useState(/** @type {Array<{ id: string, created_at: string, thumb: string | null, postId: string, texto: string | null }>} */ ([]))
  const [comentarios, setComentarios] = useState(
    /** @type {Array<{ id: string, created_at: string, texto: string, postId: string }>} */ ([])
  )
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!usuarioId) return
    let ativo = true
    const run = async () => {
      setCarregando(true)
      const [cRes, kRes] = await Promise.all([
        supabase
          .from('curtidas')
          .select('id, created_at, post_id, posts(id, texto, conteudo_url, foto_url, deleted_at)')
          .eq('usuario_id', usuarioId)
          .not('post_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(40),
        supabase
          .from('comentarios')
          .select('id, texto, created_at, post_id, posts(deleted_at)')
          .eq('autor_id', usuarioId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(40),
      ])
      if (!ativo) return
      const cRows = cRes.data ?? []
      const mappedC = cRows
        .map((row) => {
          const p = row.posts && typeof row.posts === 'object' && !Array.isArray(row.posts) ? row.posts : null
          if (!p) return null
          const pr = /** @type {Record<string, unknown>} */ (p)
          if (pr.deleted_at != null) return null
          const url = pr.conteudo_url || pr.foto_url
          return {
            id: String(row.id),
            created_at: String(row.created_at ?? ''),
            thumb: url != null ? String(url) : null,
            postId: String(row.post_id ?? ''),
            texto: pr.texto != null ? String(pr.texto) : null,
          }
        })
        .filter((x) => x != null)
      setCurtidas(mappedC)
      const kRows = kRes.data ?? []
      setComentarios(
        kRows
          .filter((row) => {
            const p = row.posts && typeof row.posts === 'object' && !Array.isArray(row.posts) ? row.posts : null
            const pr = /** @type {Record<string, unknown>} */ (p || {})
            return pr.deleted_at == null
          })
          .map((row) => ({
            id: String(row.id),
            texto: String(row.texto ?? ''),
            created_at: String(row.created_at ?? ''),
            postId: String(row.post_id ?? ''),
          }))
      )
      setCarregando(false)
    }
    void run()
    return () => {
      ativo = false
    }
  }, [usuarioId])

  const trunc = (s, n = 80) => (s.length <= n ? s : `${s.slice(0, n)}…`)

  return (
    <div className="px-1">
      <div className="mb-3 flex rounded-lg bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => setAba('curtidas')}
          className={`flex-1 rounded-md py-2 text-sm font-medium ${aba === 'curtidas' ? 'bg-white text-[#0097b2] shadow-sm' : 'text-gray-500'}`}
        >
          Curtidas
        </button>
        <button
          type="button"
          onClick={() => setAba('comentarios')}
          className={`flex-1 rounded-md py-2 text-sm font-medium ${aba === 'comentarios' ? 'bg-white text-[#0097b2] shadow-sm' : 'text-gray-500'}`}
        >
          Comentários
        </button>
      </div>

      {carregando ? <p className="py-6 text-center text-sm text-gray-400">Carregando…</p> : null}

      {!carregando && aba === 'curtidas' ? (
        <ul className="space-y-2">
          {curtidas.length === 0 ? (
            <li className="py-6 text-center text-sm text-gray-400">Nenhuma curtida em posts.</li>
          ) : (
            curtidas.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/atividades/${encodeURIComponent(c.postId)}`}
                  className="flex gap-3 rounded-lg border border-gray-100 p-2 transition hover:bg-gray-50"
                >
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    {c.thumb ? <Image src={c.thumb} alt="" fill className="object-cover" sizes="56px" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-400">{new Date(c.created_at).toLocaleString('pt-BR')}</p>
                    <p className="line-clamp-2 text-sm text-gray-700">{c.texto ? trunc(c.texto) : 'Post'}</p>
                  </div>
                </Link>
              </li>
            ))
          )}
        </ul>
      ) : null}

      {!carregando && aba === 'comentarios' ? (
        <ul className="space-y-2">
          {comentarios.length === 0 ? (
            <li className="py-6 text-center text-sm text-gray-400">Nenhum comentário.</li>
          ) : (
            comentarios.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/atividades/${encodeURIComponent(c.postId)}?comentario=${encodeURIComponent(c.id)}`}
                  className="block rounded-lg border border-gray-100 p-3 transition hover:bg-gray-50"
                >
                  <p className="text-xs text-gray-400">{new Date(c.created_at).toLocaleString('pt-BR')}</p>
                  <p className="mt-1 text-sm text-gray-800">{trunc(c.texto, 100)}</p>
                </Link>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
