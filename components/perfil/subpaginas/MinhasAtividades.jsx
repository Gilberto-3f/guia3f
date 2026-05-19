'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatarDataRelativaPublicacao } from '@/lib/formatarDataPublicacao'
import { getPerfilHref } from '@/lib/perfil-utils'
import { enriquecerMinhasAtividadesPerfis, fetchMinhasAtividadesLinhas } from '@/lib/fetchMinhasAtividades'

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
      try {
        const base = /** @type {LinhaInteracao[]} */ (await fetchMinhasAtividadesLinhas(supabase, usuarioId))
        if (!ativo) return
        setLinhas(base)
        setCarregando(false)

        const enriquecidas = /** @type {LinhaInteracao[]} */ (
          await enriquecerMinhasAtividadesPerfis(supabase, base)
        )
        if (!ativo) return
        setLinhas(enriquecidas)
      } catch {
        if (ativo) {
          setLinhas([])
          setCarregando(false)
        }
      }
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
