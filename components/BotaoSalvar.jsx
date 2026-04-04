'use client'

import { useEffect, useState } from 'react'
import { Bookmark } from 'lucide-react'
import { supabase } from '@/lib/supabase'

/**
 * @param {{ postId: string, usuarioId: string | null }} props
 */
export default function BotaoSalvar({ postId, usuarioId }) {
  const [salvo, setSalvo] = useState(false)

  useEffect(() => {
    if (!usuarioId || !postId) return
    const check = async () => {
      const { data } = await supabase.from('item_salvo').select('id').eq('post_id', postId).eq('usuario_id', usuarioId).maybeSingle()
      setSalvo(Boolean(data))
    }
    void check()
  }, [postId, usuarioId])

  const toggle = async () => {
    if (!usuarioId) return
    if (salvo) {
      await supabase.from('item_salvo').delete().eq('post_id', postId).eq('usuario_id', usuarioId)
      setSalvo(false)
    } else {
      const { error } = await supabase.from('item_salvo').insert({ post_id: postId, usuario_id: usuarioId })
      if (!error) setSalvo(true)
    }
  }

  return (
    <button type="button" onClick={() => void toggle()} className="p-1 text-gray-600" disabled={!usuarioId} aria-label="Salvar">
      <Bookmark className={`h-5 w-5 ${salvo ? 'fill-[#0097b2] text-[#0097b2]' : 'text-gray-500'}`} aria-hidden />
    </button>
  )
}
