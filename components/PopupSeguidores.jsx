'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
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
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50">
      <div className="max-h-[80vh] w-full overflow-hidden rounded-t-2xl bg-white">
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white p-4">
          <h2 className="text-lg font-semibold">Seguidores</h2>
          <button type="button" onClick={onClose} className="p-1" aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto p-4" style={{ maxHeight: 'calc(80vh - 70px)' }}>
          {loading ? (
            <div className="py-8 text-center text-gray-400">Carregando...</div>
          ) : seguidores.length === 0 ? (
            <div className="py-8 text-center text-gray-400">Nenhum seguidor ainda</div>
          ) : (
            <div className="space-y-3">
              {seguidores.map((seguidor) => (
                <div key={seguidor.id} className="flex items-center gap-3">
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
                      <User size={20} className="text-gray-400" aria-hidden />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-800">{seguidor.nome}</p>
                    <p className="text-sm text-gray-500">@{seguidor.username}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
