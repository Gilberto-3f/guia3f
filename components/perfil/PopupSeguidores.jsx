'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Users, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { buscarPerfisPorIds, getPerfilHref } from '@/lib/perfil-utils'

/**
 * @param {{
 *   aberto: boolean
 *   onFechar: () => void
 *   profileId: string
 *   meuId: string | null
 * }} props
 */
export default function PopupSeguidores({ aberto, onFechar, profileId, meuId }) {
  const [lista, setLista] = useState(
    /** @type {{ usuario_id: string; empresa_id: string | null; tipo: string; nome: string; username: string; foto_url: string | null; jaSigo: boolean }[]} */ (
      []
    )
  )

  const carregar = useCallback(async () => {
    const { data: rows, error: errR } = await supabase.from('redecontatos').select('seguidor_id').eq('seguido_id', profileId)
    if (errR) console.error('redecontatos (seguidores):', errR)

    const ids = [...new Set((rows ?? []).map((r) => String(r.seguidor_id)).filter(Boolean))]
    if (ids.length === 0) {
      setLista([])
      return
    }

    const perfis = await buscarPerfisPorIds(supabase, ids)

    /** @type {Set<string>} */
    let minhas = new Set()
    if (meuId) {
      const { data: meus, error: errM } = await supabase.from('redecontatos').select('seguido_id').eq('seguidor_id', meuId)
      if (errM) console.error('redecontatos (meu seguindo):', errM)
      minhas = new Set((meus ?? []).map((m) => String(m.seguido_id)))
    }

    setLista(
      perfis.map((p) => ({
        usuario_id: String(p.usuario_id ?? ''),
        empresa_id: p.empresa_id != null ? String(p.empresa_id) : null,
        tipo: String(p.tipo ?? ''),
        nome: String(p.nome ?? 'Usuário'),
        username: String(p.username ?? 'usuario'),
        foto_url: p.foto_url != null ? String(p.foto_url) : null,
        jaSigo: minhas.has(String(p.usuario_id ?? '')),
      }))
    )
  }, [profileId, meuId])

  useEffect(() => {
    if (aberto) void carregar()
  }, [aberto, carregar])

  const toggleSeguir = async (seguidoId) => {
    if (!meuId || seguidoId === meuId) return
    const row = lista.find((l) => l.usuario_id === seguidoId)
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
    <div className="fixed inset-0 z-[230] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onFechar} role="presentation">
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white text-black shadow-xl sm:max-h-[85vh] sm:rounded-2xl"
        style={{ height: 'min(70vh, 85vh)' }}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative shrink-0 border-b border-gray-100 bg-white pt-4 pb-2">
          <div className="flex items-center justify-center gap-2">
            <Users className="h-5 w-5 text-[#0097b2]" />
            <h2 className="text-xl font-bold text-[#0097b2]">SEGUIDORES</h2>
          </div>
          <button type="button" onClick={onFechar} className="absolute right-3 top-3 rounded-full p-1 hover:bg-gray-100" aria-label="Fechar">
            <X size={22} />
          </button>
        </div>
        <div className="scrollbar-perfil min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2">
          {lista.length === 0 ? <p className="py-8 text-center text-sm text-gray-500">Nenhum item encontrado</p> : null}
          {lista.map((row) => {
            const href = getPerfilHref(row)
            return (
              <div key={row.usuario_id} className="flex items-center gap-3 border-b border-gray-100 py-2 last:border-0">
                <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-0.5 hover:bg-gray-50">
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-100">
                    {row.foto_url ? <Image src={row.foto_url} alt="" fill className="object-cover" sizes="40px" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-800">{row.nome}</p>
                    <p className="truncate text-sm text-gray-500">@{row.username}</p>
                  </div>
                </Link>
                {meuId && row.usuario_id !== meuId ? (
                  <button
                    type="button"
                    onClick={() => void toggleSeguir(row.usuario_id)}
                    className={`ml-auto shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${row.jaSigo ? 'border border-[#0097b2] text-[#0097b2]' : 'bg-[#0097b2] text-white'}`}
                  >
                    {row.jaSigo ? 'SEGUINDO' : 'SEGUIR'}
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
