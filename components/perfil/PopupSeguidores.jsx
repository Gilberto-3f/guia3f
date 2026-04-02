'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { Users, X } from 'lucide-react'
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
    <div className="fixed inset-0 z-50 bg-black/50" onClick={onFechar} role="presentation">
      <div
        className="animate-perfil-sheet absolute inset-x-0 bottom-0 flex h-full w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl"
        style={{ height: 'calc(100vh - 9cm)' }}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative border-b border-gray-100 bg-white pt-4 pb-2">
          <div className="flex items-center justify-center gap-2">
            <Users className="h-5 w-5 text-[#0097b2]" />
            <h2 className="text-xl font-bold text-[#0097b2]">SEGUIDORES</h2>
          </div>
          <button type="button" onClick={onFechar} className="absolute right-3 top-3 rounded-full p-1 hover:bg-gray-100" aria-label="Fechar">
            <X size={22} />
          </button>
        </div>
        <div className="scrollbar-perfil overflow-y-auto px-4 py-2" style={{ height: 'calc(100% - 100px)' }}>
          {lista.length === 0 ? <p className="py-8 text-center text-sm text-gray-500">Nenhum item encontrado</p> : null}
          {lista.map((row) => (
            <div key={row.id} className="flex items-center gap-3 border-b border-gray-100 py-2 last:border-0">
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-100">
                {row.foto ? <Image src={row.foto} alt="" fill className="object-cover" sizes="40px" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-800">{row.nome}</p>
                <p className="truncate text-sm text-gray-500">@{row.username}</p>
              </div>
              {meuId && row.id !== meuId ? (
                <button
                  type="button"
                  onClick={() => void toggleSeguir(row.id)}
                  className={`ml-auto shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${row.jaSigo ? 'border border-[#0097b2] text-[#0097b2]' : 'bg-[#0097b2] text-white'}`}
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
