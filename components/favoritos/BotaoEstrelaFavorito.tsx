'use client'

import { useCallback, useEffect, useState, type MouseEvent } from 'react'
import { Star } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toggleFavorito, type FavoritoAlvoTipo } from '@/lib/favoritosTurista'
import { useProfissionalGate } from '@/context/ProfissionalGateContext'

type Props = {
  usuarioId: string | null
  alvoId: string
  tipo: FavoritoAlvoTipo
  inicial?: boolean
  className?: string
  size?: number
  onChange?: (salvo: boolean) => void
}

/** Estrela de favorito (azul logo). Só turista interage — página /favoritos. Sempre visível. */
export default function BotaoEstrelaFavorito({
  usuarioId,
  alvoId,
  tipo,
  inicial = false,
  className = '',
  size = 20,
  onChange,
}: Props) {
  const { perfilEhTurista, loading: gateLoading } = useProfissionalGate()
  const [salvo, setSalvo] = useState(inicial)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setSalvo(inicial)
  }, [inicial, alvoId])

  const onClick = useCallback(
    async (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (!usuarioId || !alvoId || busy || !perfilEhTurista) return
      setBusy(true)
      const prev = salvo
      setSalvo(!prev)
      try {
        const next = await toggleFavorito(supabase, usuarioId, alvoId, tipo)
        setSalvo(next)
        onChange?.(next)
      } catch (err) {
        console.error('[BotaoEstrelaFavorito]', err)
        setSalvo(prev)
        const msg = err instanceof Error ? err.message : 'Não foi possível salvar o favorito.'
        window.alert(msg)
      } finally {
        setBusy(false)
      }
    },
    [usuarioId, alvoId, tipo, busy, salvo, onChange, perfilEhTurista],
  )

  const starCls = salvo || inicial ? 'fill-[#0097b2] text-[#0097b2]' : 'fill-none text-[#0097b2]'

  if (gateLoading) {
    return (
      <span className={`inline-flex shrink-0 items-center justify-center ${className}`} aria-hidden>
        <Star className={starCls} size={size} strokeWidth={2.25} />
      </span>
    )
  }

  if (!perfilEhTurista || !usuarioId) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center ${className}`}
        title="Favorito"
        aria-hidden
      >
        <Star className={starCls} size={size} strokeWidth={2.25} />
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={(e) => void onClick(e)}
      disabled={busy}
      className={`inline-flex shrink-0 items-center justify-center rounded-md p-0.5 text-[#0097b2] transition hover:opacity-80 disabled:opacity-50 ${className}`}
      aria-label={salvo ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
      aria-pressed={salvo}
    >
      <Star
        className={salvo ? 'fill-[#0097b2] text-[#0097b2]' : 'fill-none text-[#0097b2]'}
        size={size}
        strokeWidth={2.25}
        aria-hidden
      />
    </button>
  )
}
