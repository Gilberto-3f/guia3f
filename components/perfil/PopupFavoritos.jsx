'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { pickAutorDisplay } from '@/lib/feed-autor'

/**
 * @param {{
 *   aberto: boolean
 *   onFechar: () => void
 *   profileId: string
 *   meuId: string | null
 * }} props
 */
export default function PopupFavoritos({ aberto, onFechar, profileId, meuId }) {
  const [aba, setAba] = useState(/** @type {'empresas' | 'usuarios'} */ ('empresas'))
  const [emps, setEmps] = useState(/** @type {{ id: string; nome: string; username: string; foto: string | null }[]} */ ([]))
  const [users, setUsers] = useState(/** @type {{ id: string; nome: string; username: string; foto: string | null }[]} */ ([]))
  const [confirmEmp, setConfirmEmp] = useState(/** @type {string | null} */ (null))
  const [confirmUser, setConfirmUser] = useState(/** @type {string | null} */ (null))

  const souEu = meuId != null && meuId === profileId

  const carregar = useCallback(async () => {
    const { data: fav } = await supabase
      .from('favoritos')
      .select('empresa_id, empresas(id, nome_fantasia, nome_usuario, foto_url)')
      .eq('usuario_id', profileId)

    const empRows =
      fav?.map((row) => {
        const e = row.empresas
        if (!e || typeof e !== 'object') return null
        const er = /** @type {Record<string, unknown>} */ (e)
        return {
          id: String(er.id ?? ''),
          nome: String(er.nome_fantasia ?? 'Empresa'),
          username: String(er.nome_usuario ?? 'empresa'),
          foto: er.foto_url != null ? String(er.foto_url) : null,
        }
      }).filter(Boolean) ?? []

    setEmps(/** @type {typeof empRows} */ (empRows))

    const { data: seg } = await supabase.from('redecontatos').select('seguido_id').eq('seguidor_id', profileId)

    const ids = [...new Set((seg ?? []).map((s) => String(s.seguido_id)).filter(Boolean))]
    if (ids.length === 0) {
      setUsers([])
      return
    }

    const { data: usuarios } = await supabase
      .from('usuarios')
      .select('id, email, turistas(nome_completo, nome_usuario, foto_perfil_url), profissionais(nome_completo, nome_usuario, foto_perfil_url), empresas(nome_fantasia, nome_usuario, foto_url)')
      .in('id', ids)

    const urows =
      usuarios?.map((u) => {
        const a = pickAutorDisplay(u)
        return { id: String(u.id), nome: a.nome, username: a.username, foto: a.foto_perfil_url }
      }) ?? []

    setUsers(urows)
  }, [profileId])

  useEffect(() => {
    if (aberto) void carregar()
  }, [aberto, carregar])

  const deixarEmpresa = async (empresaId) => {
    if (!souEu || !meuId) return
    await supabase.from('favoritos').delete().eq('usuario_id', meuId).eq('empresa_id', empresaId)
    setConfirmEmp(null)
    void carregar()
  }

  const deixarUsuario = async (seguidoId) => {
    if (!souEu || !meuId) return
    await supabase.from('redecontatos').delete().eq('seguidor_id', meuId).eq('seguido_id', seguidoId)
    setConfirmUser(null)
    void carregar()
  }

  if (!aberto) return null

  const lista = aba === 'empresas' ? emps : users

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-8" onClick={onFechar}>
      <div
        className="flex max-h-[75vh] w-full max-w-md flex-col rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="sticky top-0 z-10 mb-2 flex items-center justify-between border-b border-gray-100 bg-white px-4 pb-2 pt-4">
          <h2 className="text-lg font-semibold text-[#001f3f]">Favoritos</h2>
          <button type="button" onClick={onFechar} className="rounded-full p-1 hover:bg-gray-100" aria-label="Fechar">
            <X size={22} />
          </button>
        </div>

        <div className="flex border-b border-[#E0E0E0] px-2">
          <button
            type="button"
            onClick={() => setAba('empresas')}
            className={`flex-1 py-2 text-xs font-semibold ${aba === 'empresas' ? 'border-b-2 border-[#0097b2] text-[#0097b2]' : 'text-gray-500'}`}
          >
            EMPRESAS ({emps.length})
          </button>
          <button
            type="button"
            onClick={() => setAba('usuarios')}
            className={`flex-1 py-2 text-xs font-semibold ${aba === 'usuarios' ? 'border-b-2 border-[#0097b2] text-[#0097b2]' : 'text-gray-500'}`}
          >
            USUÁRIOS ({users.length})
          </button>
        </div>

        <div className="scrollbar-perfil flex-1 overflow-y-auto px-4 pb-4">
          {lista.length === 0 ? <p className="py-8 text-center text-sm text-gray-400">Nada aqui</p> : null}
          {lista.map((row) => (
            <div key={row.id} className="flex items-center gap-3 border-b border-gray-50 py-3 last:border-0">
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-gray-100">
                {row.foto ? <Image src={row.foto} alt="" fill className="object-cover" sizes="44px" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#001f3f]">{row.nome}</p>
                <p className="truncate text-xs text-gray-500">@{row.username}</p>
              </div>
              {souEu ? (
                <button
                  type="button"
                  onClick={() => (aba === 'empresas' ? setConfirmEmp(row.id) : setConfirmUser(row.id))}
                  className="shrink-0 rounded border border-[#0097b2] px-2 py-1 text-[10px] font-bold text-[#0097b2]"
                >
                  SEGUINDO
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {confirmEmp ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="max-w-sm rounded-lg bg-white p-4 shadow-xl">
            <p className="text-sm text-gray-700">Deixar de seguir esta empresa?</p>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="text-sm text-gray-600" onClick={() => setConfirmEmp(null)}>
                Cancelar
              </button>
              <button type="button" className="text-sm font-medium text-red-600" onClick={() => void deixarEmpresa(confirmEmp)}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmUser ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="max-w-sm rounded-lg bg-white p-4 shadow-xl">
            <p className="text-sm text-gray-700">Deixar de seguir este usuário?</p>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="text-sm text-gray-600" onClick={() => setConfirmUser(null)}>
                Cancelar
              </button>
              <button type="button" className="text-sm font-medium text-red-600" onClick={() => void deixarUsuario(confirmUser)}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
