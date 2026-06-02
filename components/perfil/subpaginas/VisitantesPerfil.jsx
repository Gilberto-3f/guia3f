'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AvatarImage from '@/components/AvatarImage'
import { supabase } from '@/lib/supabase'
import { listarVisitasPerfil, marcarVisitasPerfilComoVistas } from '@/lib/perfilVisitas'

const AVATAR_VISITANTE = 'h-11 w-11 shrink-0 rounded-md object-cover'

/**
 * @param {{ usuarioId: string | null }} props
 */
export default function VisitantesPerfil({ usuarioId }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [visitas, setVisitas] = useState(/** @type {import('@/lib/perfilVisitas').VisitaPerfilRow[]} */ ([]))

  const carregar = useCallback(async () => {
    if (!usuarioId) {
      setVisitas([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const lista = await listarVisitasPerfil(supabase, usuarioId, { limit: 60 })
      setVisitas(lista)
    } finally {
      setLoading(false)
    }
    void marcarVisitasPerfilComoVistas(supabase, usuarioId).then(() => {
      window.dispatchEvent(new CustomEvent('perfil-visitas-lidas'))
    })
  }, [usuarioId])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const abrirPerfil = (visitanteId) => {
    if (!visitanteId) return
    router.push(`/perfil/${visitanteId}`)
  }

  return (
    <div className="space-y-4 text-gray-900">
      <h2 className="text-lg font-bold text-[#001f3f]">Visitantes do perfil</h2>

      {loading ? (
        <ul className="space-y-2" aria-busy="true" aria-label="Carregando visitantes">
          {[1, 2, 3].map((i) => (
            <li
              key={i}
              className="flex animate-pulse items-center gap-3 rounded-xl border border-gray-100 bg-white px-3 py-2.5"
            >
              <div className={`${AVATAR_VISITANTE} bg-gray-200`} />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-32 rounded bg-gray-200" />
                <div className="h-3 w-24 rounded bg-gray-100" />
              </div>
            </li>
          ))}
        </ul>
      ) : visitas.length === 0 ? (
        <p className="rounded-xl border border-gray-100 bg-gray-50 py-10 text-center text-sm text-gray-500">
          Nenhuma visita registrada ainda.
        </p>
      ) : (
        <ul className="space-y-2">
          {visitas.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => abrirPerfil(v.visitante_usuario_id)}
                disabled={!v.visitante_usuario_id}
                className="flex w-full items-center gap-3 rounded-xl border border-gray-100 bg-white px-3 py-2.5 text-left shadow-sm transition hover:bg-gray-50 disabled:opacity-60"
              >
                <AvatarImage
                  src={v.visitante_foto_url}
                  alt=""
                  width={44}
                  height={44}
                  className={AVATAR_VISITANTE}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold text-gray-900">{v.visitante_nome}</span>
                    {v.pendente ? (
                      <span className="rounded-full bg-[#00D443]/15 px-2 py-0.5 text-[10px] font-bold uppercase text-[#0097b2]">
                        Nova
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-gray-500">
                    {v.visitante_username}
                    {' · '}
                    {v.tipo_alvo === 'empresa' ? 'Página da empresa' : 'Perfil social'}
                  </div>
                  <div className="text-[11px] text-gray-400">
                    {new Date(v.visitado_em).toLocaleString('pt-BR')}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
