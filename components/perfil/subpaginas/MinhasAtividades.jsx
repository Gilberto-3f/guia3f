'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatarDataRelativaPublicacao } from '@/lib/formatarDataPublicacao'
import { buscarPerfisPorIds, getPerfilHref } from '@/lib/perfil-utils'

/**
 * @typedef {{
 *   id: string
 *   ts: string
 *   postId: string
 *   kind: 'curtida' | 'comentario'
 *   comentarioId?: string | null
 *   thumb: string | null
 *   texto: string | null
 *   textoComentario?: string | null
 *   postAutorUsuarioId?: string | null
 *   postAutorUsername?: string | null
 *   postAutorEmpresaId?: string | null
 *   postAutorTipo?: string | null
 *   postEhFoto?: boolean
 * }} LinhaInteracao
 */

/**
 * @param {unknown} p
 * @returns {{ deleted_at: unknown, texto: unknown, conteudo_url: unknown, foto_url: unknown, tipo?: unknown, autor_id?: unknown } | null}
 */
function postEmb(p) {
  if (p == null) return null
  const raw = Array.isArray(p) ? p[0] : p
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const pr = /** @type {Record<string, unknown>} */ (raw)
  return {
    deleted_at: pr.deleted_at,
    texto: pr.texto,
    conteudo_url: pr.conteudo_url,
    foto_url: pr.foto_url,
    tipo: pr.tipo,
    autor_id: pr.autor_id,
  }
}

/**
 * Mesma ideia que o feed de atividades: foto / misto, ou mídia sem texto legível.
 * @param {{ texto?: unknown, conteudo_url?: unknown, foto_url?: unknown, tipo?: unknown } | null} pr
 */
function postInteracaoEhFoto(pr) {
  if (!pr) return false
  const t = String(pr.tipo ?? 'texto').toLowerCase()
  if (t === 'foto' || t === 'misto') return true
  const url = pr.conteudo_url || pr.foto_url
  const hasUrl = url != null && String(url).trim() !== ''
  const hasText = pr.texto != null && String(pr.texto).trim() !== ''
  return hasUrl && !hasText
}

/**
 * @param {{
 *   usuarioId: string
 *   onAbrirPublicacao: (postId: string, comentarioId?: string | null) => void
 * }} props
 */
export default function MinhasAtividades({ usuarioId, onAbrirPublicacao }) {
  const [linhas, setLinhas] = useState(/** @type {LinhaInteracao[]} */ ([]))
  const [carregando, setCarregando] = useState(true)
  const [aba, setAba] = useState(/** @type {'curtidas' | 'comentarios'} */ ('curtidas'))

  useEffect(() => {
    if (!usuarioId) return
    let ativo = true
    const run = async () => {
      setCarregando(true)
      const [cRes, ccRes, kRes] = await Promise.all([
        supabase
          .from('curtidas')
          .select('id, created_at, post_id, posts(id, texto, conteudo_url, foto_url, deleted_at)')
          .eq('usuario_id', usuarioId)
          .not('post_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(40),
        supabase
          .from('curtidas')
          .select(
            'id, created_at, comentario_id, comentarios(id, texto, post_id, deleted_at, posts(id, texto, conteudo_url, foto_url, deleted_at))'
          )
          .eq('usuario_id', usuarioId)
          .is('post_id', null)
          .not('comentario_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(40),
        supabase
          .from('comentarios')
          .select('id, texto, created_at, post_id, posts(id, texto, conteudo_url, foto_url, deleted_at, tipo, autor_id)')
          .eq('autor_id', usuarioId)
          .is('deleted_at', null)
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

      for (const row of ccRes.data ?? []) {
        const cid = row.comentario_id != null ? String(row.comentario_id) : ''
        const rawCom = row.comentarios
        const com = Array.isArray(rawCom) ? rawCom[0] : rawCom
        if (!com || typeof com !== 'object' || Array.isArray(com)) continue
        const cr = /** @type {Record<string, unknown>} */ (com)
        if (cr.deleted_at != null) continue
        const postIdCom = cr.post_id != null ? String(cr.post_id) : ''
        if (!postIdCom) continue
        const pr = postEmb(cr.posts)
        if (!pr || pr.deleted_at != null) continue
        const url = pr.conteudo_url || pr.foto_url
        acc.push({
          id: `cc-${row.id}`,
          ts: String(row.created_at ?? ''),
          postId: postIdCom,
          kind: 'curtida',
          comentarioId: cid || null,
          thumb: url != null ? String(url) : null,
          texto: pr.texto != null ? String(pr.texto) : null,
          textoComentario: cr.texto != null ? String(cr.texto) : null,
        })
      }

      const comentarioRows = /** @type {Record<string, unknown>[]} */ (kRes.data ?? [])
      const autorIdsPost = [
        ...new Set(
          comentarioRows
            .map((row) => {
              const pr = postEmb(row.posts)
              return pr?.autor_id != null ? String(pr.autor_id) : ''
            })
            .filter(Boolean)
        ),
      ]
      /** @type {Map<string, { usuario_id: string; username: string; empresa_id: string | null; tipo: string }>} */
      const perfilAutorPost = new Map()
      if (autorIdsPost.length > 0) {
        const perfis = await buscarPerfisPorIds(supabase, autorIdsPost)
        for (const p of perfis) {
          perfilAutorPost.set(String(p.usuario_id), p)
        }
      }

      for (const row of comentarioRows) {
        const pr = postEmb(row.posts)
        if (!pr || pr.deleted_at != null) continue
        const url = pr.conteudo_url || pr.foto_url
        const autorPostId = pr.autor_id != null ? String(pr.autor_id) : ''
        const perfilAutor = autorPostId ? perfilAutorPost.get(autorPostId) : undefined
        acc.push({
          id: `k-${row.id}`,
          ts: String(row.created_at ?? ''),
          postId: String(row.post_id ?? ''),
          kind: 'comentario',
          comentarioId: String(row.id),
          thumb: url != null ? String(url) : null,
          texto: pr.texto != null ? String(pr.texto) : null,
          textoComentario: row.texto != null ? String(row.texto) : null,
          postAutorUsuarioId: autorPostId || null,
          postAutorUsername: perfilAutor?.username != null ? String(perfilAutor.username) : 'usuario',
          postAutorEmpresaId: perfilAutor?.empresa_id != null ? String(perfilAutor.empresa_id) : null,
          postAutorTipo: perfilAutor?.tipo != null ? String(perfilAutor.tipo) : null,
          postEhFoto: postInteracaoEhFoto(pr),
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

  const linhasFiltradas = useMemo(() => {
    if (aba === 'comentarios') return linhas.filter((L) => L.kind === 'comentario')
    return linhas.filter((L) => L.kind === 'curtida')
  }, [linhas, aba])

  const rotulo = (k) => {
    if (k === 'curtida') return 'Curtiu'
    return 'Comentou'
  }

  const tabCls = (ativo) =>
    `flex-1 py-2.5 text-center text-xs font-semibold tracking-wide transition-colors ${
      ativo ? 'border-b-[3px] border-[#0097b2] text-[#0097b2]' : 'border-b-[3px] border-transparent text-gray-500'
    }`

  return (
    <div className="px-1">
      <div className="mb-1 flex border-b border-gray-200">
        <button type="button" className={tabCls(aba === 'curtidas')} onClick={() => setAba('curtidas')}>
          CURTIDAS
        </button>
        <button type="button" className={tabCls(aba === 'comentarios')} onClick={() => setAba('comentarios')}>
          COMENTÁRIOS
        </button>
      </div>

      {carregando ? <p className="mt-2 py-6 text-center text-sm text-gray-400">Carregando…</p> : null}

      {!carregando ? (
        <ul className="mt-2 divide-y divide-gray-100">
          {linhasFiltradas.length === 0 ? (
            <li className="py-6 text-center text-sm text-gray-400">
              {aba === 'comentarios' ? 'Nenhum comentário ainda.' : 'Nenhuma curtida ainda.'}
            </li>
          ) : (
            linhasFiltradas.map((L) => {
              const mostrarThumb = Boolean(L.thumb)
              const abrir = () => {
                if (L.kind === 'comentario' && L.comentarioId) {
                  onAbrirPublicacao(L.postId, L.comentarioId)
                } else if (L.kind === 'curtida' && L.comentarioId) {
                  onAbrirPublicacao(L.postId, L.comentarioId)
                } else {
                  onAbrirPublicacao(L.postId, null)
                }
              }
              const textoPostExibir = L.texto != null && String(L.texto).trim() !== '' ? String(L.texto).trimEnd() : null
              const textoComentExibir =
                L.textoComentario != null && String(L.textoComentario).trim() !== ''
                  ? String(L.textoComentario).trimEnd()
                  : null
              const metaComentario = (
                <p className="w-full min-w-0 text-xs text-gray-400">
                  {L.postEhFoto ? 'Comentou foto de ' : 'Comentou post de '}
                  {L.postAutorUsuarioId ? (
                    <Link
                      href={getPerfilHref({
                        usuario_id: L.postAutorUsuarioId,
                        empresa_id: L.postAutorEmpresaId,
                        tipo: L.postAutorTipo ?? undefined,
                      })}
                      className="font-medium text-[#0097b2] hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      @{L.postAutorUsername ?? 'usuario'}
                    </Link>
                  ) : (
                    <span className="font-medium text-gray-700">@usuario</span>
                  )}
                  {' · '}
                  {L.ts ? formatarDataRelativaPublicacao(L.ts) : ''}
                </p>
              )

              const metaCurtida = (
                <p className="w-full min-w-0 text-xs text-gray-400">
                  <span className="font-medium text-[#0097b2]">
                    {L.kind === 'curtida' && L.comentarioId ? 'Curtiu comentário' : rotulo(L.kind)}
                  </span>
                  {' · '}
                  {L.ts ? formatarDataRelativaPublicacao(L.ts) : ''}
                </p>
              )

              const corpoComentario = (
                <>
                  {textoPostExibir ? (
                    <p
                      className={`line-clamp-2 whitespace-pre-wrap text-sm text-gray-600 ${mostrarThumb ? '' : 'mt-1'}`}
                    >
                      {textoPostExibir}
                    </p>
                  ) : null}
                  {textoComentExibir ? (
                    <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs italic text-gray-500">
                      &ldquo;{textoComentExibir}&rdquo;
                    </p>
                  ) : null}
                </>
              )

              const corpoCurtidaComComentario = (
                <>
                  {textoPostExibir ? (
                    <p
                      className={`line-clamp-3 whitespace-pre-wrap text-sm text-gray-600 ${mostrarThumb ? '' : 'mt-1'}`}
                    >
                      {textoPostExibir}
                    </p>
                  ) : null}
                  {textoComentExibir ? (
                    <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs italic text-gray-500">
                      &ldquo;{textoComentExibir}&rdquo;
                    </p>
                  ) : null}
                </>
              )

              const corpoCurtidaPost = (
                <p
                  className={`whitespace-pre-wrap text-sm text-gray-700 ${mostrarThumb ? 'line-clamp-3' : 'mt-0.5 line-clamp-3'}`}
                >
                  {textoPostExibir != null ? textoPostExibir : 'Post'}
                </p>
              )

              const thumbBlock = mostrarThumb ? (
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                  <Image src={L.thumb} alt="" fill className="object-cover" sizes="56px" />
                </div>
              ) : null

              const cardBase =
                'w-full cursor-pointer rounded-lg border border-gray-100 p-2 text-left transition hover:bg-gray-50'

              return (
                <li key={L.id} className="min-w-0 py-2 first:pt-0">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={abrir}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        abrir()
                      }
                    }}
                    className={mostrarThumb ? `flex flex-col gap-1 ${cardBase}` : `flex ${cardBase}`}
                    aria-label={
                      L.kind === 'comentario'
                        ? `Comentário em publicação, ${L.postEhFoto ? 'foto' : 'post'} de @${L.postAutorUsername ?? 'usuario'}`
                        : L.kind === 'curtida' && L.comentarioId
                          ? 'Curtiu comentário — abrir publicação'
                          : `${rotulo(L.kind)} — abrir publicação`
                    }
                  >
                    {mostrarThumb ? (
                      <>
                        {L.kind === 'comentario' ? metaComentario : metaCurtida}
                        <div className="flex min-w-0 gap-3">
                          {thumbBlock}
                          <div className="min-w-0 flex-1">
                            {L.kind === 'comentario'
                              ? corpoComentario
                              : L.kind === 'curtida' && L.comentarioId
                                ? corpoCurtidaComComentario
                                : corpoCurtidaPost}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="min-w-0 flex-1">
                        {L.kind === 'comentario' ? (
                          <>
                            {metaComentario}
                            {corpoComentario}
                          </>
                        ) : (
                          <>
                            {metaCurtida}
                            {L.kind === 'curtida' && L.comentarioId ? corpoCurtidaComComentario : corpoCurtidaPost}
                          </>
                        )}
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
