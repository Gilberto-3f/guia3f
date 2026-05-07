'use client'

import { useEffect, useRef, useState } from 'react'
import { Ban, Flag, MoreHorizontal, Pencil, Repeat2, Trash2, UserMinus, UserPlus, Bookmark } from 'lucide-react'
import { supabase } from '@/lib/supabase'

/** Nome do evento global após soft delete bem-sucedido (cascata no estado do feed/perfil). */
export const POST_DELETED_EVENT = 'post-deleted'

/**
 * `postParentId` = coluna `post_original_id` da linha apagada (`null` = post raiz; listeners removem também reposts com `post_original_id === postId`).
 *
 * @param {{
 *   postId: string
 *   postParentId?: string | null
 *   autorUsuarioId: string
 *   meuUsuarioId: string | null
 *   empresaAlvo?: { empresaId: string, jaSegue: boolean } | null
 *   usuarioAlvo?: { seguidoId: string, seguidoTipo: string, jaSegue: boolean } | null
 *   salvo?: boolean
 *   onApagou?: () => void
 *   onSeguiuEmpresa?: () => void
 *   onSeguiuUsuario?: () => void
 *   onEditar?: () => void
 *   onSalvar?: () => void
 *   onRepublicar?: () => void
 *   bloqueado?: boolean
 * }} props
 */
export default function MenuPost({
  postId,
  postParentId = null,
  autorUsuarioId,
  meuUsuarioId,
  empresaAlvo,
  usuarioAlvo,
  salvo = false,
  onApagou,
  onSeguiuEmpresa,
  onSeguiuUsuario,
  onEditar,
  onSalvar,
  onRepublicar,
  bloqueado = false,
}) {
  const [aberto, setAberto] = useState(false)
  const [passoExcluir, setPassoExcluir] = useState(0)
  const ref = useRef(/** @type {HTMLDivElement | null} */ (null))

  const meuPost = meuUsuarioId != null && meuUsuarioId === autorUsuarioId

  useEffect(() => {
    const fechar = (e) => {
      if (ref.current && !ref.current.contains(/** @type {Node} */ (e.target))) setAberto(false)
    }
    document.addEventListener('click', fechar)
    return () => document.removeEventListener('click', fechar)
  }, [])

  const denunciar = () => {
    alert('Denúncia registrada (fluxo em configuração).')
    setAberto(false)
  }

  const excluir = async () => {
    if (passoExcluir === 0) {
      setPassoExcluir(1)
      return
    }
    const { error } = await supabase
      .from('posts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', postId)
      .eq('autor_id', meuUsuarioId ?? '')
    if (!error) {
      const { error: rpcErr } = await supabase.rpc('limpar_dados_ao_excluir_post', { p_post_id: postId })
      if (rpcErr && rpcErr.message && !String(rpcErr.message).includes('not_allowed')) {
        console.error('limpar_dados_ao_excluir_post:', rpcErr)
      }
      window.dispatchEvent(
        new CustomEvent(POST_DELETED_EVENT, {
          detail: { postId, postParentId: postParentId ?? null },
        })
      )
      onApagou?.()
    }
    setPassoExcluir(0)
    setAberto(false)
  }

  const toggleSeguirEmpresa = async () => {
    if (!empresaAlvo || !meuUsuarioId) return
    if (empresaAlvo.jaSegue) {
      await supabase
        .from('favoritos')
        .delete()
        .eq('usuario_id', meuUsuarioId)
        .eq('alvo_id', empresaAlvo.empresaId)
        .eq('alvo_tipo', 'empresa')
    } else {
      await supabase.from('favoritos').insert({
        usuario_id: meuUsuarioId,
        alvo_id: empresaAlvo.empresaId,
        alvo_tipo: 'empresa',
      })
    }
    setAberto(false)
    onSeguiuEmpresa?.()
  }

  const toggleSeguirUsuario = async () => {
    if (!usuarioAlvo || !meuUsuarioId) return
    if (usuarioAlvo.jaSegue) {
      await supabase.from('redecontatos').delete().eq('seguidor_id', meuUsuarioId).eq('seguido_id', usuarioAlvo.seguidoId)
    } else {
      await supabase.from('redecontatos').insert({
        seguidor_id: meuUsuarioId,
        seguido_id: usuarioAlvo.seguidoId,
        seguido_tipo: usuarioAlvo.seguidoTipo,
      })
    }
    setAberto(false)
    onSeguiuUsuario?.()
  }

  const itemClass =
    'flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-white transition-colors hover:bg-[#007a8f]'

  if (bloqueado) return null

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="rounded p-1 text-gray-500 hover:bg-gray-100"
        aria-label="Menu"
      >
        <MoreHorizontal size={22} />
      </button>
      {aberto ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 min-w-[200px] overflow-hidden rounded-lg bg-[#0097b2] py-1 text-white shadow-lg">
          {meuPost ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setAberto(false)
                  onEditar?.()
                }}
                className={itemClass}
              >
                <Pencil size={16} className="text-white" aria-hidden />
                <span>Editar</span>
              </button>
              <button type="button" onClick={() => void excluir()} className={itemClass}>
                <Trash2 size={16} className="text-white" aria-hidden />
                <span>{passoExcluir === 0 ? 'Excluir…' : 'Confirmar exclusão'}</span>
              </button>
            </>
          ) : (
            <>
              {empresaAlvo ? (
                <button type="button" onClick={() => void toggleSeguirEmpresa()} className={itemClass}>
                  {empresaAlvo.jaSegue ? (
                    <UserMinus size={16} className="text-white" aria-hidden />
                  ) : (
                    <UserPlus size={16} className="text-white" aria-hidden />
                  )}
                  <span>{empresaAlvo.jaSegue ? 'Deixar de seguir' : 'Seguir'}</span>
                </button>
              ) : null}
              {usuarioAlvo ? (
                <button type="button" onClick={() => void toggleSeguirUsuario()} className={itemClass}>
                  {usuarioAlvo.jaSegue ? (
                    <UserMinus size={16} className="text-white" aria-hidden />
                  ) : (
                    <UserPlus size={16} className="text-white" aria-hidden />
                  )}
                  <span>{usuarioAlvo.jaSegue ? 'Deixar de seguir' : 'Seguir'}</span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setAberto(false)
                  onSalvar?.()
                }}
                disabled={!meuUsuarioId}
                className={`${itemClass} disabled:opacity-50`}
              >
                <Bookmark size={16} className="text-white" aria-hidden />
                <span>{salvo ? 'Remover dos salvos' : 'Salvar'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAberto(false)
                  onRepublicar?.()
                }}
                disabled={!meuUsuarioId}
                className={`${itemClass} disabled:opacity-50`}
              >
                <Repeat2 size={16} className="text-white" aria-hidden />
                <span>Repostar</span>
              </button>
              <button type="button" onClick={denunciar} className={itemClass}>
                <Flag size={16} className="text-white" aria-hidden />
                <span>Denunciar</span>
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
