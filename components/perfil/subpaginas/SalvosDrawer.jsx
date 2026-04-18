'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { pickAutorDisplay } from '@/lib/feed-autor'
import { formatarDataRelativaPublicacao } from '@/lib/formatarDataPublicacao'
import { useRouter } from '@/i18n/navigation'

/**
 * @param {{
 *   usuarioId: string | null
 *   onAbrirPublicacao?: (postId: string, comentarioId?: string | null) => void
 * }} props
 */
export default function SalvosDrawer({ usuarioId, onAbrirPublicacao }) {
  const router = useRouter()
  const [linhas, setLinhas] = useState(/** @type {{ post: ReturnType<typeof mapViewRow>, salvoEm: string }[]} */ ([]))
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async (uid) => {
    const { data: salvos, error } = await supabase
      .from('item_salvo')
      .select('post_id, salvo_em')
      .eq('usuario_id', uid)
      .order('salvo_em', { ascending: false })

    if (error) {
      console.error(error)
      setLinhas([])
      return
    }

    const idsOrdered = []
    const seen = new Set()
    const salvoEmById = new Map()
    for (const r of salvos ?? []) {
      const id = String(r.post_id ?? '')
      if (!id) continue
      if (!salvoEmById.has(id)) salvoEmById.set(id, String(r.salvo_em ?? ''))
      if (seen.has(id)) continue
      seen.add(id)
      idsOrdered.push(id)
    }

    if (idsOrdered.length === 0) {
      setLinhas([])
      return
    }

    const { data: viewRows, error: e2 } = await supabase.from('posts_com_autores').select('*').in('id', idsOrdered)
    if (e2) {
      console.error(e2)
      setLinhas([])
      return
    }

    const byId = new Map()
    for (const row of viewRows ?? []) {
      const r = /** @type {Record<string, unknown>} */ (row)
      byId.set(String(r.id), r)
    }

    const ordenados = []
    for (const id of idsOrdered) {
      const raw = byId.get(id)
      if (!raw) continue
      if (raw.deleted_at != null && raw.deleted_at !== '') continue
      ordenados.push({
        post: mapViewRow(raw),
        salvoEm: salvoEmById.get(id) ?? '',
      })
    }
    setLinhas(ordenados)
  }, [])

  useEffect(() => {
    if (!usuarioId) {
      setLinhas([])
      setLoading(false)
      return
    }
    setLoading(true)
    void carregar(usuarioId).finally(() => setLoading(false))
  }, [usuarioId, carregar])

  const abrirPost = useCallback(
    (postId) => {
      if (onAbrirPublicacao) {
        onAbrirPublicacao(postId, null)
        return
      }
      router.push(`/perfil/atividades/${encodeURIComponent(postId)}`)
    },
    [onAbrirPublicacao, router]
  )

  if (!usuarioId) {
    return <p className="px-1 text-sm text-gray-500">Entre na conta para ver as publicações salvas.</p>
  }

  return (
    <div className="px-1 pb-4">
      {loading ? <p className="py-6 text-center text-sm text-gray-400">Carregando…</p> : null}
      {!loading ? (
        <ul className="divide-y divide-gray-100">
          {linhas.length === 0 ? (
            <li className="py-8 text-center text-sm text-gray-500">Nenhuma publicação salva ainda.</li>
          ) : (
            linhas.map(({ post, salvoEm }) => {
              const url = post.foto_url || post.conteudo_url
              const mostrarThumb = url != null && String(url).trim() !== ''
              const textoPost =
                post.texto != null && String(post.texto).trim() !== '' ? String(post.texto).trimEnd() : null
              const cardBase =
                'w-full cursor-pointer rounded-lg border border-gray-100 p-2 text-left transition hover:bg-gray-50'

              const linhaMeta = (
                <p className="w-full min-w-0 text-xs text-gray-400">
                  <span className="font-medium text-[#0097b2]">Salvou</span>
                  {' · '}
                  {salvoEm ? formatarDataRelativaPublicacao(salvoEm) : ''}
                </p>
              )

              const linhaTextoPost = (
                <p
                  className={`whitespace-pre-wrap text-sm text-gray-700 ${
                    mostrarThumb ? 'line-clamp-2' : 'mt-0.5 line-clamp-4'
                  }`}
                >
                  {textoPost != null ? textoPost : 'Publicação'}
                </p>
              )

              return (
                <li key={post.id} className="min-w-0 py-2 first:pt-0">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => abrirPost(post.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        abrirPost(post.id)
                      }
                    }}
                    className={mostrarThumb ? `flex flex-col gap-1 ${cardBase}` : `flex ${cardBase}`}
                    aria-label="Publicação salva — abrir"
                  >
                    {mostrarThumb ? (
                      <>
                        {linhaMeta}
                        <div className="flex min-w-0 gap-3">
                          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                            <Image src={String(url)} alt="" fill className="object-cover" sizes="56px" />
                          </div>
                          <div className="min-w-0 flex-1">{linhaTextoPost}</div>
                        </div>
                      </>
                    ) : (
                      <div className="min-w-0 flex-1">
                        {linhaMeta}
                        {linhaTextoPost}
                      </div>
                    )}
                  </div>
                </li>
              )
            })
          )}
        </ul>
      ) : null}
    </div>
  )
}

/** @param {unknown} raw */
function mapViewRow(raw) {
  const p = /** @type {Record<string, unknown>} */ (raw)
  let u = p.usuarios
  if (typeof p.usuarios === 'string') {
    try {
      u = JSON.parse(p.usuarios)
    } catch {
      u = null
    }
  }
  const autor = pickAutorDisplay(u)
  return {
    id: String(p.id),
    tipo: p.tipo != null ? String(p.tipo) : 'texto',
    texto: p.texto != null ? String(p.texto) : null,
    foto_url: p.foto_url != null ? String(p.foto_url) : null,
    conteudo_url: p.conteudo_url != null ? String(p.conteudo_url) : null,
    total_curtidas: Number(p.total_curtidas) || 0,
    total_comentarios: Number(p.total_comentarios) || 0,
    total_compartilhamentos: Number(p.total_compartilhamentos) || 0,
    total_reposts: Number(p.total_reposts) || 0,
    avaliacao_meta:
      p.avaliacao_meta && typeof p.avaliacao_meta === 'object' && !Array.isArray(p.avaliacao_meta)
        ? p.avaliacao_meta
        : null,
    created_at: String(p.created_at ?? ''),
    post_original_id: p.post_original_id != null ? String(p.post_original_id) : null,
    autor,
  }
}
