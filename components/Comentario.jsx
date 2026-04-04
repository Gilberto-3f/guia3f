'use client'

import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import { supabase } from '@/lib/supabase'

/**
 * @param {{
 *   comentario: {
 *     id: string
 *     texto: string
 *     created_at: string
 *     total_curtidas: number
 *     autor: { nome: string, username: string, foto_perfil_url: string | null }
 *   }
 *   usuarioId: string | null
 *   destacado?: boolean
 * }} props
 */
export default function Comentario({ comentario, usuarioId, destacado = false }) {
  const [curtiu, setCurtiu] = useState(false)
  const [total, setTotal] = useState(comentario.total_curtidas ?? 0)

  useEffect(() => {
    setTotal(comentario.total_curtidas ?? 0)
  }, [comentario.total_curtidas])

  useEffect(() => {
    if (!usuarioId) return
    const check = async () => {
      const { data } = await supabase
        .from('curtidas')
        .select('id')
        .eq('comentario_id', comentario.id)
        .eq('usuario_id', usuarioId)
        .maybeSingle()
      setCurtiu(Boolean(data))
    }
    void check()
  }, [comentario.id, usuarioId])

  const toggle = async () => {
    if (!usuarioId) return
    if (curtiu) {
      await supabase.from('curtidas').delete().eq('comentario_id', comentario.id).eq('usuario_id', usuarioId)
      setCurtiu(false)
      setTotal((t) => Math.max(0, t - 1))
    } else {
      const { error } = await supabase.from('curtidas').insert({ comentario_id: comentario.id, usuario_id: usuarioId })
      if (error) return
      setCurtiu(true)
      setTotal((t) => t + 1)
    }
  }

  const tempo = new Date(comentario.created_at).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div
      id={`comentario-${comentario.id}`}
      className={`flex gap-2 border-b border-gray-100 py-3 last:border-0 ${destacado ? 'rounded-lg bg-[#0097b2]/10 ring-2 ring-[#0097b2]/40' : ''}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900">{comentario.autor.nome}</p>
        <p className="text-xs text-gray-600">@{comentario.autor.username} · {tempo}</p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{comentario.texto}</p>
      </div>
      <button
        type="button"
        onClick={() => void toggle()}
        className="flex shrink-0 flex-col items-center gap-0.5 text-xs text-gray-500"
        disabled={!usuarioId}
      >
        <Heart size={18} className={curtiu ? 'fill-red-500 text-red-500' : ''} aria-hidden />
        {total}
      </button>
    </div>
  )
}
