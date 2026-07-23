'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { pickAutorDisplay } from '@/lib/feed-autor'
import { formatarDataRelativaPublicacao } from '@/lib/formatarDataPublicacao'
import { useRouter } from '@/i18n/navigation'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'
import { listarItensCatalogoSalvos } from '@/lib/favoritosTurista'
import { buscarUsuarioIdsEmpresaPresencaPublicaVigente } from '@/lib/empresaPresencaPublica'
import { formatarUsd } from '@/lib/comprasCdeCatalogo'
import { formatarPrecoTicket } from '@/lib/atrativosCatalogo'
import DrawerProdutosCde from '@/components/DrawerProdutosCde'
import DrawerTicketsAtrativos from '@/components/DrawerTicketsAtrativos'

/**
 * @param {{
 *   usuarioId: string | null
 *   onAbrirPublicacao?: (postId: string, comentarioId?: string | null) => void
 * }} props
 */
export default function SalvosDrawer({ usuarioId, onAbrirPublicacao }) {
  const router = useRouter()
  const {
    perfilEhTurista,
    perfilEhEmpresa,
    loading: gateLoading,
  } = useProfissionalGate()
  /** Profissional / ADM: misturam mini-cards com posts. Turista e empresa: não. */
  const misturarCatalogo = !perfilEhTurista && !perfilEhEmpresa

  /** @type {[Array<LinhaSalvo>, Function]} */
  const [linhas, setLinhas] = useState([])
  const [loading, setLoading] = useState(true)
  /** @type {[null | { empresaId: string, empresaNome: string, produtoId: string }, Function]} */
  const [drawerProduto, setDrawerProduto] = useState(null)
  /** @type {[null | { empresaId: string, empresaNome: string, ticketId: string }, Function]} */
  const [drawerTicket, setDrawerTicket] = useState(null)

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

          // Posts de empresa irregular (ciclo vencido): invisíveis nos salvos.
          const autorIds = [
            ...new Set(
              postsLinhas.map((l) => String(l.post?.autor?.usuario_id ?? '').trim()).filter(Boolean),
            ),
          ]
          if (autorIds.length > 0) {
            const [{ data: empRows }, vigentesUsuarios] = await Promise.all([
              supabase.from('empresas').select('usuario_id').in('usuario_id', autorIds),
              buscarUsuarioIdsEmpresaPresencaPublicaVigente(supabase),
            ])
            const gestoresEmpresa = new Set(
              (empRows ?? [])
                .map((e) => (e.usuario_id != null ? String(e.usuario_id) : ''))
                .filter(Boolean),
            )
            const vigentesSet = new Set(vigentesUsuarios)
            const filtrados = postsLinhas.filter((l) => {
              const aid = String(l.post?.autor?.usuario_id ?? '').trim()
              if (!aid || !gestoresEmpresa.has(aid)) return true
              return vigentesSet.has(aid)
            })
            postsLinhas.length = 0
            postsLinhas.push(...filtrados)
          }
        }
      }

      /** @type {LinhaSalvo[]} */
      let misturado = [...postsLinhas]

      if (misturarCatalogo) {
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
    [misturarCatalogo],
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
    if (!usuarioId || !misturarCatalogo) return
    const onFav = () => void carregar(usuarioId)
    window.addEventListener('favoritos-turista-atualizados', onFav)
    return () => window.removeEventListener('favoritos-turista-atualizados', onFav)
  }, [usuarioId, misturarCatalogo, carregar])

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

  if (!usuarioId) {
    return <p className="px-1 text-sm text-gray-500">Entre na conta para ver as publicações salvas.</p>
  }

  return (
    <div className="px-1 pb-4">
      {loading || gateLoading ? <p className="py-6 text-center text-sm text-gray-400">Carregando…</p> : null}
      {!loading && !gateLoading ? (
        <ul className="space-y-3">
          {linhas.length === 0 ? (
            <li className="py-8 text-center text-sm text-gray-500">Nenhuma publicação salva ainda.</li>
          ) : (
            linhas.map((linha) => {
              if (linha.kind === 'catalogo') {
                const { item } = linha
                if (item.kind === 'produto') {
                  return (
                    <li
                      key={`cat-produto-${item.id}`}
                      className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
                    >
                      <p className="px-3 pt-3 text-sm font-semibold text-[#001f3f]">{item.titulo}</p>
                      <div className="mt-2 aspect-[4/3] bg-gray-100">
                        {item.foto_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.foto_url} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="space-y-2 p-3">
                        {item.marca_nome ? (
                          <p className="text-sm font-semibold text-[#001f3f]">{item.marca_nome}</p>
                        ) : null}
                        {item.empresa_nome ? (
                          <p className="truncate text-xs text-gray-500">{item.empresa_nome}</p>
                        ) : null}
                        {item.preco != null ? (
                          <p className="text-sm font-bold text-[#0097b2]">
                            {formatarUsd(item.preco)}
                            {(item.percentual_desconto ?? 0) > 0 ? (
                              <span className="ml-1.5 rounded bg-[#00D443]/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#00D443]">
                                −{item.percentual_desconto}%
                              </span>
                            ) : null}
                          </p>
                        ) : null}
                        {item.empresa_id ? (
                          <button
                            type="button"
                            onClick={() =>
                              setDrawerProduto({
                                empresaId: item.empresa_id,
                                empresaNome: item.empresa_nome || 'Empresa',
                                produtoId: item.id,
                              })
                            }
                            className="w-full rounded-lg bg-[#0097b2] py-2 text-xs font-bold text-white"
                          >
                            Ver produto
                          </button>
                        ) : null}
                      </div>
                    </li>
                  )
                }

                if (item.kind === 'ticket') {
                  return (
                    <li
                      key={`cat-ticket-${item.id}`}
                      className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
                    >
                      <p className="px-3 pt-3 text-sm font-semibold text-[#001f3f]">{item.titulo}</p>
                      <div className="mt-2 aspect-[4/3] bg-gray-100">
                        {item.foto_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.foto_url} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="space-y-2 p-3">
                        {item.empresa_nome ? (
                          <p className="truncate text-xs text-gray-500">{item.empresa_nome}</p>
                        ) : null}
                        {item.preco_inteira != null ? (
                          <p className="text-sm font-bold text-[#0097b2]">
                            {formatarPrecoTicket(item.preco_inteira)}
                            <span className="font-normal text-gray-500"> / inteira</span>
                          </p>
                        ) : null}
                        {item.preco_meia != null ? (
                          <p className="text-xs font-semibold text-gray-600">
                            Meia: {formatarPrecoTicket(item.preco_meia)}
                          </p>
                        ) : null}
                        {item.empresa_id ? (
                          <button
                            type="button"
                            onClick={() =>
                              setDrawerTicket({
                                empresaId: item.empresa_id,
                                empresaNome: item.empresa_nome || 'Empresa',
                                ticketId: item.id,
                              })
                            }
                            className="w-full rounded-lg bg-[#0097b2] py-2 text-xs font-bold text-white"
                          >
                            Ver ticket
                          </button>
                        ) : null}
                      </div>
                    </li>
                  )
                }

                // acomodacao
                return (
                  <li
                    key={`cat-acomodacao-${item.id}`}
                    className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
                  >
                    <p className="px-3 pt-3 text-sm font-semibold text-[#001f3f]">{item.titulo}</p>
                    <div className="mt-2 aspect-[4/3] bg-gray-100">
                      {item.foto_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.foto_url} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="space-y-2 p-3">
                      {item.subtitulo ? (
                        <p className="text-sm font-semibold text-[#001f3f]">{item.subtitulo}</p>
                      ) : null}
                      {item.empresa_nome ? (
                        <p className="truncate text-xs text-gray-500">{item.empresa_nome}</p>
                      ) : null}
                      {item.valor_diaria != null ? (
                        <p className="text-sm font-bold text-[#0097b2]">
                          {item.valor_diaria.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                          <span className="font-normal text-gray-500"> / diária</span>
                        </p>
                      ) : null}
                      {item.empresa_id ? (
                        <button
                          type="button"
                          onClick={() => router.push(`/empresa/${item.empresa_id}`)}
                          className="w-full rounded-lg bg-[#0097b2] py-2 text-xs font-bold text-white"
                        >
                          Ver empresa
                        </button>
                      ) : null}
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
                <li key={`post-${post.id}`} className="min-w-0">
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

      {drawerTicket ? (
        <DrawerTicketsAtrativos
          isOpen
          onClose={() => setDrawerTicket(null)}
          empresaId={drawerTicket.empresaId}
          empresaNome={drawerTicket.empresaNome}
          ticketIdInicial={drawerTicket.ticketId}
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
