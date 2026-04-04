'use client'

import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { supabase } from '@/lib/supabase'

/**
 * @param {{
 *   postId: string
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
 * }} props
 */
export default function MenuPost({
  postId,
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
    if (!confirm('Confirma exclusão permanente?')) {
      setPassoExcluir(0)
      return
    }
    await supabase.from('posts').update({ deleted_at: new Date().toISOString() }).eq('id', postId).eq('autor_id', meuUsuarioId ?? '')
    setPassoExcluir(0)
    setAberto(false)
    onApagou?.()
  }

  const toggleSeguirEmpresa = async () => {
    if (!empresaAlvo || !meuUsuarioId) return
    if (empresaAlvo.jaSegue) {
      await supabase.from('favoritos').delete().eq('usuario_id', meuUsuarioId).eq('empresa_id', empresaAlvo.empresaId)
    } else {
      await supabase.from('favoritos').insert({ usuario_id: meuUsuarioId, empresa_id: empresaAlvo.empresaId })
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

  const itemClass = 'block w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50'

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setAberto((v) => !v)} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="Menu">
        <MoreHorizontal size={22} />
      </button>
      {aberto ? (
        <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-gray-100 bg-white py-1 text-black shadow-lg">
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
                ✏️ Editar
              </button>
              <button type="button" onClick={() => void excluir()} className={`${itemClass} text-red-600`}>
                {passoExcluir === 0 ? '🗑️ Excluir…' : '🗑️ Confirmar exclusão'}
              </button>
            </>
          ) : (
            <>
              {empresaAlvo ? (
                <button type="button" onClick={() => void toggleSeguirEmpresa()} className={itemClass}>
                  {empresaAlvo.jaSegue ? '🔴 Deixar de seguir' : '➕ Seguir'}
                </button>
              ) : null}
              {usuarioAlvo ? (
                <button type="button" onClick={() => void toggleSeguirUsuario()} className={itemClass}>
                  {usuarioAlvo.jaSegue ? '🔴 Deixar de seguir' : '➕ Seguir'}
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
                {salvo ? '🔖 Remover dos salvos' : '🔖 Salvar'}
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
                ↩️ Republicar
              </button>
              <button type="button" onClick={denunciar} className={itemClass}>
                ⚠️ Denunciar
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
