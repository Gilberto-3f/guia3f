'use client'

import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'

/**
 * @param {{ postId: string, totalInicial: number, usuarioId: string | null }} props
 */
export default function BotaoCurtir({ postId, totalInicial, usuarioId }) {
  const { podeInteragir, notificarSomenteLeitura } = useModoApresentacao()
  const [curtiu, setCurtiu] = useState(false)
  const [total, setTotal] = useState(totalInicial)

  useEffect(() => {
    setTotal(totalInicial)
  }, [totalInicial, postId])

  useEffect(() => {
    if (!usuarioId || !postId) return
    const check = async () => {
      const { data } = await supabase.from('curtidas').select('id').eq('post_id', postId).eq('usuario_id', usuarioId).maybeSingle()
      setCurtiu(Boolean(data))
    }
    void check()
  }, [postId, usuarioId])

  const toggle = async () => {
    if (!podeInteragir) {
      notificarSomenteLeitura()
      return
    }
    if (!usuarioId) return
    if (curtiu) {
      await supabase.from('curtidas').delete().eq('post_id', postId).eq('usuario_id', usuarioId)
      setCurtiu(false)
      setTotal((t) => Math.max(0, t - 1))
    } else {
      const { error } = await supabase.from('curtidas').insert({ post_id: postId, usuario_id: usuarioId })
      if (error) return
      setCurtiu(true)
      setTotal((t) => t + 1)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      className="flex items-center gap-1 text-sm text-gray-600"
      disabled={!usuarioId || !podeInteragir}
    >
      <Heart size={22} className={curtiu ? 'fill-red-500 text-red-500' : 'text-gray-500'} aria-hidden />
      <span>{total}</span>
    </button>
  )
}
