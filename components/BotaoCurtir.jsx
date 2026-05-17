'use client'

import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { notificarEngajamentoAtividades } from '@/lib/atividades-events'
import { asUuidFilter } from '@/lib/supabaseRestUuid'

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
    const pid = asUuidFilter(postId)
    const uid = asUuidFilter(usuarioId)
    if (!pid || !uid) return
    const check = async () => {
      const { data } = await supabase.from('curtidas').select('id').match({ post_id: pid, usuario_id: uid }).maybeSingle()
      setCurtiu(Boolean(data))
    }
    void check()
  }, [postId, usuarioId])

  const toggle = async () => {
    if (!podeInteragir) {
      notificarSomenteLeitura()
      return
    }
    const pid = asUuidFilter(postId)
    const uid = asUuidFilter(usuarioId)
    if (!pid || !uid) return
    if (curtiu) {
      const totalAntes = total
      setCurtiu(false)
      setTotal((t) => Math.max(0, t - 1))
      const { data: removidas, error } = await supabase
        .from('curtidas')
        .delete()
        .match({ post_id: pid, usuario_id: uid })
        .select('id')
      if (error || !removidas?.length) {
        if (error) console.error('[BotaoCurtir] descurtir:', error)
        else console.warn('[BotaoCurtir] descurtir: nenhuma curtida removida', { pid, uid })
        setCurtiu(true)
        setTotal(totalAntes)
        return
      }
      const curtidaId = removidas[0]?.id != null ? String(removidas[0].id) : undefined
      notificarEngajamentoAtividades({
        sincronizarLista: true,
        remover: { autorId: uid, postId: pid, curtidaId },
      })
    } else {
      const { error } = await supabase.from('curtidas').insert({ post_id: pid, usuario_id: uid })
      if (error) return
      setCurtiu(true)
      setTotal((t) => t + 1)
      notificarEngajamentoAtividades()
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
