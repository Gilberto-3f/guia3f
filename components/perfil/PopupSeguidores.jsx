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
export default function PopupSeguidores({ aberto, onFechar, profileId, meuId }) {
  const [lista, setLista] = useState(/** @type {{ id: string; nome: string; username: string; foto: string | null; jaSigo: boolean }[]} */ ([]))

  const carregar = useCallback(async () => {
    const { data: rows } = await supabase.from('redecontatos').select('seguidor_id').eq('seguido_id', profileId)

    const ids = [...new Set((rows ?? []).map((r) => String(r.seguidor_id)).filter(Boolean))]
    if (ids.length === 0) {
      setLista([])
      return
    }

    const { data: usuarios } = await supabase
      .from('usuarios')
      .select('id, email, turistas(nome_completo, nome_usuario, foto_perfil_url), profissionais(nome_completo, nome_usuario, foto_perfil_url), empresas(nome_fantasia, nome_usuario, foto_url)')
      .in('id', ids)

    let minhas = /** @type {Set<string>} */ (new Set())
    if (meuId) {
      const { data: meus } = await supabase.from('redecontatos').select('seguido_id').eq('seguidor_id', meuId)
      minhas = new Set((meus ?? []).map((m) => String(m.seguido_id)))
    }

    const out =
      usuarios?.map((u) => {
        const a = pickAutorDisplay(u)
        const uid = String(u.id)
        return {
          id: uid,
          nome: a.nome,
          username: a.username,
          foto: a.foto_perfil_url,
          jaSigo: minhas.has(uid),
        }
      }) ?? []

    setLista(out)
  }, [profileId, meuId])

  useEffect(() => {
    if (aberto) void carregar()
  }, [aberto, carregar])

  const toggleSeguir = async (seguidoId) => {
    if (!meuId || seguidoId === meuId) return
    const row = lista.find((l) => l.id === seguidoId)
    if (!row) return
    if (row.jaSigo) {
      await supabase.from('redecontatos').delete().eq('seguidor_id', meuId).eq('seguido_id', seguidoId)
    } else {
      const { data: roleRow } = await supabase.from('usuarios').select('role').eq('id', seguidoId).maybeSingle()
      const tipo = roleRow?.role != null ? String(roleRow.role) : 'user'
      await supabase.from('redecontatos').insert({ seguidor_id: meuId, seguido_id: seguidoId, seguido_tipo: tipo })
    }
    void carregar()
  }

  if (!aberto) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-8" onClick={onFechar}>
      <div
        className="flex max-h-[75vh] w-full max-w-md flex-col rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="sticky top-0 z-10 mb-2 flex items-center justify-between border-b border-gray-100 bg-white px-4 pb-2 pt-4">
          <h2 className="text-lg font-semibold text-[#001f3f]">Seguidores</h2>
          <button type="button" onClick={onFechar} className="rounded-full p-1 hover:bg-gray-100" aria-label="Fechar">
            <X size={22} />
          </button>
        </div>
        <div className="scrollbar-perfil flex-1 overflow-y-auto px-4 pb-4">
          {lista.length === 0 ? <p className="py-8 text-center text-sm text-gray-400">Nenhum seguidor</p> : null}
          {lista.map((row) => (
            <div key={row.id} className="flex items-center gap-3 border-b border-gray-50 py-3 last:border-0">
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-gray-100">
                {row.foto ? <Image src={row.foto} alt="" fill className="object-cover" sizes="44px" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#001f3f]">{row.nome}</p>
                <p className="truncate text-xs text-gray-500">@{row.username}</p>
              </div>
              {meuId && row.id !== meuId ? (
                <button
                  type="button"
                  onClick={() => void toggleSeguir(row.id)}
                  className={`shrink-0 rounded px-2 py-1 text-[10px] font-bold ${row.jaSigo ? 'border border-[#0097b2] text-[#0097b2]' : 'bg-[#0097b2] text-white'}`}
                >
                  {row.jaSigo ? 'SEGUINDO' : 'SEGUIR'}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
