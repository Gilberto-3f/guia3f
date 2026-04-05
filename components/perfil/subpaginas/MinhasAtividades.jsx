'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

/**
 * @typedef {{ id: string, ts: string, postId: string, kind: 'curtida' | 'comentario' | 'salvo' | 'repost', comentarioId?: string | null, thumb: string | null, texto: string | null }} LinhaInteracao
 */

/**
 * @param {unknown} p
 * @returns {{ deleted_at: unknown, texto: unknown, conteudo_url: unknown, foto_url: unknown } | null}
 */
function postEmb(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null
  const pr = /** @type {Record<string, unknown>} */ (p)
  return { deleted_at: pr.deleted_at, texto: pr.texto, conteudo_url: pr.conteudo_url, foto_url: pr.foto_url }
}

/**
 * @param {{ usuarioId: string }} props
 */
export default function MinhasAtividades({ usuarioId }) {
  const [linhas, setLinhas] = useState(/** @type {LinhaInteracao[]} */ ([]))
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!usuarioId) return
    let ativo = true
    const run = async () => {
      setCarregando(true)
      const [cRes, kRes, sRes, rRes] = await Promise.all([
        supabase
          .from('curtidas')
          .select('id, created_at, post_id, posts(id, texto, conteudo_url, foto_url, deleted_at)')
          .eq('usuario_id', usuarioId)
          .not('post_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(40),
        supabase
          .from('comentarios')
          .select('id, texto, created_at, post_id, posts(id, texto, conteudo_url, foto_url, deleted_at)')
          .eq('autor_id', usuarioId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(40),
        supabase
          .from('item_salvo')
          .select('id, salvo_em, post_id, posts(id, texto, conteudo_url, foto_url, deleted_at)')
          .eq('usuario_id', usuarioId)
          .order('salvo_em', { ascending: false })
          .limit(40),
        supabase
          .from('posts')
          .select('id, created_at, post_original_id')
          .eq('autor_id', usuarioId)
          .not('post_original_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(40),
      ])
      if (!ativo) return

      /** @type {LinhaInteracao[]} */
      const acc = []

      for (const row of cRes.data ?? []) {
        const pr = postEmb(row.posts)
        if (!pr || pr.deleted_at != null) continue
        const url = pr.conteudo_url || pr.foto_url
        acc.push({
          id: `c-${row.id}`,
          ts: String(row.created_at ?? ''),
          postId: String(row.post_id ?? ''),
          kind: 'curtida',
          comentarioId: null,
          thumb: url != null ? String(url) : null,
          texto: pr.texto != null ? String(pr.texto) : null,
        })
      }

      for (const row of kRes.data ?? []) {
        const pr = postEmb(row.posts)
        if (!pr || pr.deleted_at != null) continue
        const url = pr.conteudo_url || pr.foto_url
        acc.push({
          id: `k-${row.id}`,
          ts: String(row.created_at ?? ''),
          postId: String(row.post_id ?? ''),
          kind: 'comentario',
          comentarioId: String(row.id),
          thumb: url != null ? String(url) : null,
          texto: pr.texto != null ? String(pr.texto) : null,
        })
      }

      for (const row of sRes.data ?? []) {
        const pr = postEmb(row.posts)
        if (!pr || pr.deleted_at != null) continue
        const url = pr.conteudo_url || pr.foto_url
        acc.push({
          id: `s-${row.id}`,
          ts: String(row.salvo_em ?? ''),
          postId: String(row.post_id ?? ''),
          kind: 'salvo',
          comentarioId: null,
          thumb: url != null ? String(url) : null,
          texto: pr.texto != null ? String(pr.texto) : null,
        })
      }

      const repostRows = rRes.data ?? []
      const origIds = [...new Set(repostRows.map((r) => String(r.post_original_id ?? '')).filter(Boolean))]
      /** @type {Map<string, Record<string, unknown>>} */
      const origById = new Map()
      if (origIds.length > 0) {
        const { data: origPosts } = await supabase
          .from('posts')
          .select('id, texto, conteudo_url, foto_url, deleted_at')
          .in('id', origIds)
        for (const o of origPosts ?? []) {
          const rec = /** @type {Record<string, unknown>} */ (o)
          origById.set(String(rec.id ?? ''), rec)
        }
      }

      for (const row of repostRows) {
        const oid = String(row.post_original_id ?? '')
        const o = origById.get(oid)
        if (!o) continue
        if (o.deleted_at != null) continue
        const url = o.conteudo_url || o.foto_url
        acc.push({
          id: `r-${row.id}`,
          ts: String(row.created_at ?? ''),
          postId: oid,
          kind: 'repost',
          comentarioId: null,
          thumb: url != null ? String(url) : null,
          texto: o.texto != null ? String(o.texto) : null,
        })
      }

      acc.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
      setLinhas(acc.slice(0, 60))
      setCarregando(false)
    }
    void run()
    return () => {
      ativo = false
    }
  }, [usuarioId])

  const trunc = (s, n = 80) => (s.length <= n ? s : `${s.slice(0, n)}…`)

  const rotulo = (k) => {
    if (k === 'curtida') return 'Curtiu'
    if (k === 'comentario') return 'Comentou'
    if (k === 'salvo') return 'Salvou'
    return 'Republicou'
  }

  const hrefLinha = (/** @type {LinhaInteracao} */ L) => {
    const base = `/perfil/atividades/${encodeURIComponent(L.postId)}`
    if (L.kind === 'comentario' && L.comentarioId) return `${base}?comentario=${encodeURIComponent(L.comentarioId)}`
    return base
  }

  return (
    <div className="px-1">
      <p className="mb-3 text-xs text-gray-500">
        Publicações do feed com as quais você interagiu (curtir, comentar, salvar ou republicar).
      </p>

      {carregando ? <p className="py-6 text-center text-sm text-gray-400">Carregando…</p> : null}

      {!carregando ? (
        <ul className="space-y-2">
          {linhas.length === 0 ? (
            <li className="py-6 text-center text-sm text-gray-400">Nenhuma interação ainda.</li>
          ) : (
            linhas.map((L) => (
              <li key={L.id}>
                <Link
                  href={hrefLinha(L)}
                  className="flex gap-3 rounded-lg border border-gray-100 p-2 transition hover:bg-gray-50"
                >
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    {L.thumb ? <Image src={L.thumb} alt="" fill className="object-cover" sizes="56px" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-400">
                      <span className="font-medium text-[#0097b2]">{rotulo(L.kind)}</span>
                      {' · '}
                      {L.ts ? new Date(L.ts).toLocaleString('pt-BR') : ''}
                    </p>
                    <p className="line-clamp-2 text-sm text-gray-700">{L.texto ? trunc(L.texto) : 'Post'}</p>
                  </div>
                </Link>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
