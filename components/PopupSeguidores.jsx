'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { X, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'

/**
 * @param {{ isOpen: boolean, onClose: () => void, empresaId: string }} props
 */
export default function PopupSeguidores({ isOpen, onClose, empresaId }) {
  const [seguidores, setSeguidores] = useState(/** @type {{ id: string, nome: string, username: string, foto_url: string | null }[]} */ ([]))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isOpen || !empresaId) return

    let ativo = true

    const carregar = async () => {
      setLoading(true)
      try {
        const { data: favs, error } = await supabase
          .from('favoritos')
          .select('usuario_id')
          .eq('empresa_id', empresaId)
          .not('empresa_id', 'is', null)
          .order('salvo_em', { ascending: true })

        if (error || !favs?.length) {
          if (ativo) setSeguidores([])
          return
        }

        const ids = [...new Set(favs.map((f) => f.usuario_id).filter(Boolean))]

        const { data: turistas } = await supabase
          .from('turistas')
          .select('usuario_id, nome_completo, nome_usuario, foto_perfil_url')
          .in('usuario_id', ids)

        const { data: profissionais } = await supabase
          .from('profissionais')
          .select('usuario_id, nome_completo, nome_usuario, foto_perfil_url')
          .in('usuario_id', ids)

        const { data: usuarios } = await supabase.from('usuarios').select('id, email').in('id', ids)

        const porUsuario = new Map()
        for (const t of turistas || []) {
          porUsuario.set(t.usuario_id, {
            nome: t.nome_completo,
            username: t.nome_usuario,
            foto_url: t.foto_perfil_url ?? null,
          })
        }
        for (const p of profissionais || []) {
          if (!porUsuario.has(p.usuario_id)) {
            porUsuario.set(p.usuario_id, {
              nome: p.nome_completo,
              username: p.nome_usuario,
              foto_url: p.foto_perfil_url ?? null,
            })
          }
        }

        const lista = ids.map((id) => {
          const perfil = porUsuario.get(id)
          const u = usuarios?.find((x) => x.id === id)
          const email = u?.email ?? ''
          return {
            id,
            nome: perfil?.nome || email || 'Usuário',
            username: perfil?.username || (email ? email.split('@')[0] : 'usuario'),
            foto_url: perfil?.foto_url ?? null,
          }
        })

        if (ativo) setSeguidores(lista)
      } finally {
        if (ativo) setLoading(false)
      }
    }

    carregar()
    return () => {
      ativo = false
    }
  }, [isOpen, empresaId])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[230] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white text-gray-900 shadow-xl sm:max-h-[85vh] sm:rounded-2xl"
        style={{ height: 'min(70vh, 85vh)' }}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative shrink-0 border-b border-gray-100 bg-white pt-4 pb-2">
          <div className="flex items-center justify-center gap-2">
            <User className="h-5 w-5 text-[#0097b2]" aria-hidden />
            <h2 className="text-xl font-bold text-[#0097b2]">SEGUIDORES</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full p-1 text-gray-700 hover:bg-gray-100"
            aria-label="Fechar"
          >
            <X size={22} />
          </button>
        </div>

        <div className="scrollbar-perfil min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2">
          {loading ? (
            <div className="py-8 text-center text-sm text-gray-500">Carregando...</div>
          ) : seguidores.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">Nenhum seguidor ainda</div>
          ) : (
            <div className="space-y-1">
              {seguidores.map((seguidor) => (
                <Link
                  key={seguidor.id}
                  href={`/perfil/${seguidor.id}`}
                  className="flex items-center gap-3 rounded-lg border-b border-gray-100 py-2 last:border-0 hover:bg-gray-50"
                >
                  {seguidor.foto_url ? (
                    <Image
                      src={seguidor.foto_url}
                      alt={seguidor.nome}
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200">
                      <User size={20} className="text-gray-500" aria-hidden />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-800">{seguidor.nome}</p>
                    <p className="truncate text-sm text-gray-500">@{seguidor.username}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
