'use client'

import { useEffect, useRef, useState } from 'react'
import { Heart } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useModoApresentacao } from '@/context/ModoApresentacaoContext'
import { notificarEngajamentoAtividades } from '@/lib/atividades-events'
import { asUuidFilter } from '@/lib/supabaseRestUuid'
import { useEmpresaInteratorSocial } from '@/lib/useEmpresaInteratorSocial'
import { usuarioCurtiuNoModoAtual } from '@/lib/curtidaModoSocial'
import { isDuplicateCurtidaError, toggleCurtidaSocial } from '@/lib/toggleCurtidaSocial'

/**
 * @param {{ postId: string, totalInicial: number, usuarioId: string | null }} props
 */
export default function BotaoCurtir({ postId, totalInicial, usuarioId }) {
  const { podeInteragir, notificarSomenteLeitura } = useModoApresentacao()
  const empresaInteratorId = useEmpresaInteratorSocial()
  const [curtiu, setCurtiu] = useState(false)
  const [total, setTotal] = useState(totalInicial)
  const curtirBusyRef = useRef(false)

  useEffect(() => {
    setTotal(totalInicial)
  }, [totalInicial, postId])

  useEffect(() => {
    const pid = asUuidFilter(postId)
    const uid = asUuidFilter(usuarioId)
    if (!pid || !uid) return
    void usuarioCurtiuNoModoAtual(supabase, {
      postId: pid,
      usuarioId: uid,
      empresaInteratorId,
    }).then(setCurtiu)
  }, [postId, usuarioId, empresaInteratorId])

  const toggle = async () => {
    if (!podeInteragir) {
      notificarSomenteLeitura()
      return
    }
    if (curtirBusyRef.current) return
    const pid = asUuidFilter(postId)
    const uid = asUuidFilter(usuarioId)
    if (!pid || !uid) return

    const eraCurtido = curtiu
    const totalAntes = total
    curtirBusyRef.current = true

    if (eraCurtido) {
      setCurtiu(false)
      setTotal((t) => Math.max(0, t - 1))
    } else {
      setCurtiu(true)
      setTotal((t) => t + 1)
    }

    try {
      const { data, error } = await toggleCurtidaSocial(supabase, {
        postId: pid,
        empresaInteratorId,
      })

      if (error && !isDuplicateCurtidaError(error)) {
        console.error('[BotaoCurtir] curtir:', error)
        setCurtiu(eraCurtido)
        setTotal(totalAntes)
        return
      }

      const liked = error && isDuplicateCurtidaError(error) ? true : Boolean(data?.liked)
      setCurtiu(liked)
      if (liked === eraCurtido) {
        setTotal(totalAntes)
      }

      if (liked && !eraCurtido) {
        notificarEngajamentoAtividades()
      } else if (!liked && eraCurtido) {
        notificarEngajamentoAtividades({
          sincronizarLista: true,
          remover: { autorId: uid, postId: pid },
        })
      }
    } finally {
      curtirBusyRef.current = false
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
