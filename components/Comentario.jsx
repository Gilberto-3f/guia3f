'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Heart } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatarDataComentarioCurta } from '@/lib/formatarDataPublicacao'
import AvatarImage from '@/components/AvatarImage'

/**
 * @param {{
 *   comentario: {
 *     id: string
 *     texto: string
 *     created_at: string
 *     total_curtidas: number
 *     autor: { nome: string, username: string, foto_perfil_url: string | null, usuario_id?: string }
 *   }
 *   usuarioId: string | null
 *   destacado?: boolean
 *   onResponder?: (texto: string) => void
 * }} props
 */
export default function Comentario({ comentario, usuarioId, destacado = false, onResponder }) {
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

  const tempo = formatarDataComentarioCurta(comentario.created_at)
  const mencao = `@${comentario.autor?.username ?? 'usuario'} `
  const avatar = comentario.autor?.foto_perfil_url
  const perfilHref = comentario.autor?.usuario_id ? `/perfil/${comentario.autor.usuario_id}` : null
  const avatarInner = avatar ? (
    <AvatarImage src={avatar} alt="" width={32} height={32} className="h-full w-full object-cover" />
  ) : (
    <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">?</div>
  )

  return (
    <div
      id={`comentario-${comentario.id}`}
      className={`flex gap-2 border-b border-gray-100 py-3 last:border-0 ${destacado ? 'rounded-lg bg-[#0097b2]/10 ring-2 ring-[#0097b2]/40' : ''}`}
    >
      {perfilHref ? (
        <Link href={perfilHref} className="relative block h-8 w-8 shrink-0 overflow-hidden rounded-md bg-gray-100">
          {avatarInner}
        </Link>
      ) : (
        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md bg-gray-100">{avatarInner}</div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0">
          {perfilHref ? (
            <Link href={perfilHref} className="text-sm font-semibold text-gray-900 hover:text-[#0097b2]">
              @{comentario.autor?.username ?? 'usuario'}
            </Link>
          ) : (
            <span className="text-sm font-semibold text-gray-900">@{comentario.autor?.username ?? 'usuario'}</span>
          )}
          <span className="text-xs text-gray-400">· {tempo}</span>
        </div>
        <p className={`mt-0.5 whitespace-pre-wrap text-sm text-gray-800 ${destacado ? 'font-bold' : ''}`}>
          {comentario.texto}
        </p>
        {onResponder ? (
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => onResponder(mencao)}
              className="text-xs font-medium text-gray-500 hover:text-[#0097b2]"
            >
              Responder
            </button>
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => void toggle()}
        className="flex shrink-0 flex-col items-center gap-0.5 self-start text-xs text-gray-500"
        disabled={!usuarioId}
      >
        <Heart size={18} className={curtiu ? 'fill-red-500 text-red-500' : ''} aria-hidden />
        {total}
      </button>
    </div>
  )
}
