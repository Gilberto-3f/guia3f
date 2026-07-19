'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { pickAutorDisplay } from '@/lib/feed-autor'
import { formatarDataRelativaPublicacao } from '@/lib/formatarDataPublicacao'
import { useRouter } from '@/i18n/navigation'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { listarItensCatalogoSalvos } from '@/lib/favoritosTurista'
import DrawerProdutosCde from '@/components/DrawerProdutosCde'
import PopupCompraAtrativos from '@/components/PopupCompraAtrativos'

/**
 * @param {{
 *   usuarioId: string | null
 *   onAbrirPublicacao?: (postId: string, comentarioId?: string | null) => void
 * }} props
 */
export default function SalvosDrawer({ usuarioId, onAbrirPublicacao }) {
  const router = useRouter()
  const { perfilEhTurista, loading: gateLoading } = useProfissionalGate()
  /** @type {[Array<LinhaSalvo>, Function]} */
  const [linhas, setLinhas] = useState([])
  const [loading, setLoading] = useState(true)
  /** @type {[null | { empresaId: string, empresaNome: string, produtoId: string }, Function]} */
  const [drawerProduto, setDrawerProduto] = useState(null)
  /** @type {[null | { empresaId: string, empresaNome: string }, Function]} */
  const [popupTicket, setPopupTicket] = useState(null)

  const carregar = useCallback(
    async (uid) => {
      const { data: salvos, error } = await supabase
        .from('item_salvo')
        .select('post_id, salvo_em')
        .eq('usuario_id', uid)
        .order('salvo_em', { ascending: false })

      if (error) {
        console.error(error)
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

      /** @type {LinhaSalvo[]} */
      const postsLinhas = []

      if (idsOrdered.length > 0) {
        const { data: viewRows, error: e2 } = await supabase
          .from('posts_com_autores')
          .select('*')
          .in('id', idsOrdered)
        if (e2) {
          console.error(e2)
        } else {
          const byId = new Map()
          for (const row of viewRows ?? []) {
            const r = /** @type {Record<string, unknown>} */ (row)
            byId.set(String(r.id), r)
          }
          for (const id of idsOrdered) {
            const raw = byId.get(id)
            if (!raw) continue
            if (raw.deleted_at != null && raw.deleted_at !== '') continue
            postsLinhas.push({
              kind: 'post',
              salvoEm: salvoEmById.get(id) ?? '',
              post: mapViewRow(raw),
            })
          }
        }
      }

      /** @type {LinhaSalvo[]} */
      let misturado = [...postsLinhas]

      // Turista: catálogo só em /favoritos. Demais: misturar em Publicações Salvas.
      if (!perfilEhTurista) {
        const catalogo = await listarItensCatalogoSalvos(supabase, uid)
        const catalogoLinhas = catalogo.map((item) => ({
          kind: 'catalogo',
          salvoEm: item.salvo_em,
          item,
        }))
        misturado = [...postsLinhas, ...catalogoLinhas].sort((a, b) => {
          const ta = a.salvoEm ? Date.parse(a.salvoEm) : 0
          const tb = b.salvoEm ? Date.parse(b.salvoEm) : 0
          return tb - ta
        })
      }

      setLinhas(misturado)
    },
    [perfilEhTurista],
  )

  useEffect(() => {
    if (!usuarioId || gateLoading) {
      if (!usuarioId) {
        setLinhas([])
        setLoading(false)
      }
      return
    }
    setLoading(true)
    void carregar(usuarioId).finally(() => setLoading(false))
  }, [usuarioId, carregar, gateLoading])

  useEffect(() => {
    if (!usuarioId || perfilEhTurista) return
    const onFav = () => void carregar(usuarioId)
    window.addEventListener('favoritos-turista-atualizados', onFav)
    return () => window.removeEventListener('favoritos-turista-atualizados', onFav)
  }, [usuarioId, perfilEhTurista, carregar])

  const abrirPost = useCallback(
    (postId) => {
      if (onAbrirPublicacao) {
        onAbrirPublicacao(postId, null)
        return
      }
      router.push(`/perfil/atividades/${encodeURIComponent(postId)}`)
    },
    [onAbrirPublicacao, router],
  )

  const abrirCatalogo = useCallback(
    (item) => {
      if (item.kind === 'produto' && item.empresa_id) {
        setDrawerProduto({
          empresaId: item.empresa_id,
          empresaNome: item.empresa_nome || 'Empresa',
          produtoId: item.id,
        })
        return
      }
      if (item.kind === 'ticket' && item.empresa_id) {
        setPopupTicket({
          empresaId: item.empresa_id,
          empresaNome: item.empresa_nome || 'Empresa',
        })
        return
      }
      if (item.kind === 'acomodacao' && item.empresa_id) {
        router.push(`/empresa/${item.empresa_id}`)
      }
    },
    [router],
  )

  if (!usuarioId) {
    return <p className="px-1 text-sm text-gray-500">Entre na conta para ver as publicações salvas.</p>
  }

  return (
    <div className="px-1 pb-4">
      {loading || gateLoading ? <p className="py-6 text-center text-sm text-gray-400">Carregando…</p> : null}
      {!loading && !gateLoading ? (
        <ul className="divide-y divide-gray-100">
          {linhas.length === 0 ? (
            <li className="py-8 text-center text-sm text-gray-500">Nenhuma publicação salva ainda.</li>
          ) : (
            linhas.map((linha) => {
              if (linha.kind === 'catalogo') {
                const { item, salvoEm } = linha
                const rotuloTipo =
                  item.kind === 'produto'
                    ? 'Produto'
                    : item.kind === 'ticket'
                      ? 'Ticket'
                      : 'Acomodação'
                const url = item.foto_url
                const mostrarThumb = url != null && String(url).trim() !== ''
                const cardBase =
                  'w-full cursor-pointer rounded-lg border border-gray-100 p-2 text-left transition hover:bg-gray-50'

                return (
                  <li key={`cat-${item.kind}-${item.id}`} className="min-w-0 py-2 first:pt-0">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => abrirCatalogo(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          abrirCatalogo(item)
                        }
                      }}
                      className={mostrarThumb ? `flex flex-col gap-1 ${cardBase}` : `flex ${cardBase}`}
                      aria-label={`${rotuloTipo} salvo — abrir`}
                    >
                      <p className="w-full min-w-0 text-xs text-gray-400">
                        <span className="font-medium text-[#0097b2]">Salvou · {rotuloTipo}</span>
                        {' · '}
                        {salvoEm ? formatarDataRelativaPublicacao(salvoEm) : ''}
                      </p>
                      <div className="flex min-w-0 gap-3">
                        {mostrarThumb ? (
                          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                            <Image src={String(url)} alt="" fill className="object-cover" sizes="56px" />
                          </div>
                        ) : (
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[10px] font-bold text-gray-400">
                            {rotuloTipo.slice(0, 3).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm font-medium text-gray-800">{item.titulo}</p>
                          {item.subtitulo ? (
                            <p className="mt-0.5 truncate text-xs text-gray-500">{item.subtitulo}</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </li>
                )
              }

              const { post, salvoEm } = linha
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
                    mostrarThumb ? 'line-clamp-3' : 'mt-0.5 line-clamp-3'
                  }`}
                >
                  {textoPost != null ? textoPost : 'Publicação'}
                </p>
              )

              return (
                <li key={`post-${post.id}`} className="min-w-0 py-2 first:pt-0">
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

      {drawerProduto ? (
        <DrawerProdutosCde
          isOpen
          onClose={() => setDrawerProduto(null)}
          empresaId={drawerProduto.empresaId}
          empresaNome={drawerProduto.empresaNome}
          produtoIdInicial={drawerProduto.produtoId}
          mostrarEmpresaNoDetalhe
        />
      ) : null}

      {popupTicket ? (
        <PopupCompraAtrativos
          isOpen
          onClose={() => setPopupTicket(null)}
          empresaId={popupTicket.empresaId}
          empresaNome={popupTicket.empresaNome}
        />
      ) : null}
    </div>
  )
}

/**
 * @typedef {{
 *   kind: 'post'
 *   salvoEm: string
 *   post: ReturnType<typeof mapViewRow>
 * } | {
 *   kind: 'catalogo'
 *   salvoEm: string
 *   item: import('@/lib/favoritosTurista').ItemCatalogoSalvo
 * }} LinhaSalvo
 */

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
