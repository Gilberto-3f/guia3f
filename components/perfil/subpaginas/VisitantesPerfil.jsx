'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import AvatarImage from '@/components/AvatarImage'
import { supabase } from '@/lib/supabase'
import {
  listarVisitasPerfil,
  marcarVisitasPerfilComoVistas,
  textoContagemVisitasDia,
} from '@/lib/perfilVisitas'

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
      const lista = await listarVisitasPerfil(supabase, usuarioId, { limit: 200 })
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

  const abrirVisitante = (v) => {
    if (!v?.visitante_usuario_id) return
    if (v.visitante_role === 'empresa' && v.visitante_empresa_id) {
      router.push(`/empresa/${v.visitante_empresa_id}`)
      return
    }
    router.push(`/perfil/${v.visitante_usuario_id}`)
  }

  const formatarData = (iso) => {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleDateString('pt-BR')
  }

  return (
    <div className="space-y-4 text-gray-900">
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
                <div className="h-3 w-40 rounded bg-gray-100" />
                <div className="h-3 w-48 rounded bg-gray-100" />
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
                onClick={() => abrirVisitante(v)}
                disabled={!v.visitante_usuario_id}
                className="flex w-full items-start gap-3 rounded-xl border border-gray-100 bg-white px-3 py-2.5 text-left shadow-sm transition hover:bg-gray-50 disabled:opacity-60"
              >
                <AvatarImage
                  src={v.visitante_foto_url}
                  alt=""
                  width={44}
                  height={44}
                  className={AVATAR_VISITANTE}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-gray-900">{v.visitante_nome}</p>
                  <p className="truncate text-xs text-gray-500">
                    {v.visitante_username}
                    {' · '}
                    {formatarData(v.visitado_em)}
                  </p>
                  <p className="mt-0.5 text-xs leading-snug text-gray-600">
                    {textoContagemVisitasDia(v)}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
